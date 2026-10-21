alter table public.sales_lines add column receipt_key text;
alter table public.sales_lines add column receipt_customer_count integer not null default 0 check(receipt_customer_count>=0);
create index sales_lines_source_row on public.sales_lines(sales_day_id,source_row_key);
alter table public.store_sales_imports drop constraint store_sales_imports_import_id_store_id_key;
alter table public.store_sales_imports add unique(import_id,store_id,business_date);

create or replace function public.import_app_profiles(p_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare row record; imported integer:=0;
begin
  if not public.has_role(array['information_systems']::public.app_role[]) then raise insufficient_privilege; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 then raise exception 'Invalid CSV'; end if;
  if exists(select 1 from jsonb_to_recordset(p_rows) as x(id uuid,active boolean) where x.id=(select auth.uid()) and not x.active) then raise exception 'Cannot disable own account'; end if;
  if (select count(distinct x.id) from jsonb_to_recordset(p_rows) as x(id uuid))<>jsonb_array_length(p_rows) then raise exception 'Duplicate users'; end if;
  for row in select * from jsonb_to_recordset(p_rows) as x(id uuid,employee_code text,display_name text,affiliation text,active boolean) order by id loop
    if length(trim(row.employee_code)) not between 1 and 80 or length(trim(row.display_name)) not between 1 and 200 or row.active is null then raise exception 'Invalid user'; end if;
    if not exists(select 1 from auth.users where id=row.id) then raise exception 'Authentication identity missing'; end if;
    insert into public.app_users(id,employee_code,display_name,affiliation,active,must_change_password)
    values(row.id,row.employee_code,row.display_name,row.affiliation,row.active,true)
    on conflict(id) do update set employee_code=excluded.employee_code,display_name=excluded.display_name,affiliation=excluded.affiliation,active=excluded.active,updated_at=clock_timestamp();
    imported:=imported+1;
  end loop;
  return imported;
end; $$;

create or replace function public.apply_canonical_sales(p_source_name text,p_checksum text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_import uuid; v_row record; v_store uuid; v_department uuid; v_product public.products%rowtype;
  v_day public.sales_days%rowtype; v_existing public.sales_lines%rowtype; v_inserted integer:=0; v_prior public.sales_imports%rowtype; v_days uuid[]:='{}'::uuid[]; v_day_id uuid;
begin
  if p_source_name is null or length(trim(p_source_name)) not between 1 and 200 or p_checksum is null or length(p_checksum)<>64 then raise exception 'Import identity required'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 10000 then raise exception 'Invalid import'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_checksum,0));
  select * into v_prior from public.sales_imports where source_checksum=p_checksum;
  if found then
    if v_prior.status<>'completed' then raise exception 'Existing import is incomplete'; end if;
    return jsonb_build_object('importId',v_prior.id,'inserted',0,'duplicate',true);
  end if;
  insert into public.sales_imports(source_file_name,source_checksum,status,rows_received,started_by)
  values(p_source_name,p_checksum,'processing',jsonb_array_length(p_rows),(select auth.uid())) returning id into v_import;
  for v_row in select * from jsonb_to_recordset(p_rows) as x(store_code text,product_code text,department_code text,business_date date,transaction_time timestamptz,source_row_key text,receipt_key text,customer_count integer,quantity numeric,amount_yen bigint,tax_rate numeric,line_type text) order by store_code,business_date,source_row_key loop
    select id into v_store from public.stores where code=v_row.store_code and status='active';
    select id into v_department from public.store_departments where store_id=v_store and code=v_row.department_code and active;
    select * into v_product from public.products where code=v_row.product_code and active;
    if v_store is null or v_department is null or v_product.id is null or v_row.transaction_time is null or v_row.business_date is null or v_row.receipt_key is null or length(trim(v_row.receipt_key))=0 or v_row.source_row_key is null or length(trim(v_row.source_row_key))=0 or v_row.amount_yen is null or v_row.quantity is null or v_row.customer_count is null or v_row.customer_count<0 then raise exception 'Invalid source master or row'; end if;
    if v_row.tax_rate not in (8,10) or v_row.tax_rate is null or v_row.line_type not in ('sale','discount','void','return') or v_row.line_type is null then raise exception 'Invalid tax or line type'; end if;
    if (v_row.line_type='sale' and (v_row.amount_yen<0 or v_row.quantity<0)) or (v_row.line_type<>'sale' and v_row.amount_yen>0) then raise exception 'Invalid amount sign'; end if;
    if v_row.business_date<>public.store_business_date(v_store,v_row.transaction_time) or v_row.transaction_time>now() then raise exception 'Business date mismatch or future transaction'; end if;
    insert into public.sales_days(store_id,business_date,status,import_id) values(v_store,v_row.business_date,'imported',v_import) on conflict(store_id,business_date) do nothing;
    select * into v_day from public.sales_days where store_id=v_store and business_date=v_row.business_date for update;
    select * into v_existing from public.sales_lines where sales_day_id=v_day.id and source_row_key=v_row.source_row_key;
    if found then
      if v_existing.amount_yen<>v_row.amount_yen or v_existing.product_id<>v_product.id or v_existing.quantity<>v_row.quantity or v_existing.tax_rate<>v_row.tax_rate or v_existing.line_type<>v_row.line_type or v_existing.transaction_time<>v_row.transaction_time or v_existing.receipt_key is distinct from v_row.receipt_key or v_existing.receipt_customer_count<>v_row.customer_count then raise exception 'Conflicting replay'; end if;
      continue;
    end if;
    if v_day.status<>'imported' then raise exception 'Confirmed or monthly finalized sales cannot be reimported'; end if;
    insert into public.sales_lines(sales_day_id,product_id,product_code_snapshot,product_name_snapshot,department_id,quantity,amount_yen,tax_rate,transaction_time,line_type,source_row_key,import_id,receipt_key,receipt_customer_count)
    values(v_day.id,v_product.id,v_product.code,v_product.name,v_department,v_row.quantity,v_row.amount_yen,v_row.tax_rate,v_row.transaction_time,v_row.line_type,v_row.source_row_key,v_import,v_row.receipt_key,v_row.customer_count);
    v_inserted:=v_inserted+1;
    v_days:=array_append(v_days,v_day.id);
    insert into public.store_sales_imports(import_id,store_id,business_date,status,rows_received,completed_at) values(v_import,v_store,v_row.business_date,'completed',1,now())
    on conflict(import_id,store_id,business_date) do update set rows_received=public.store_sales_imports.rows_received+1;
  end loop;
  for v_day_id in select distinct unnest(v_days) loop
    update public.sales_days set net_sales_yen=(select coalesce(sum(amount_yen),0) from public.sales_lines where sales_day_id=v_day_id),gross_sales_yen=(select coalesce(sum(amount_yen) filter(where line_type='sale'),0) from public.sales_lines where sales_day_id=v_day_id),transaction_count=(select count(distinct receipt_key) from public.sales_lines where sales_day_id=v_day_id),customer_count=(select coalesce(sum(guests),0) from(select max(receipt_customer_count) guests from public.sales_lines where sales_day_id=v_day_id group by receipt_key) counts),updated_at=clock_timestamp() where id=v_day_id;
  end loop;
  update public.sales_imports set status='completed',completed_at=now() where id=v_import;
  return jsonb_build_object('importId',v_import,'inserted',v_inserted,'duplicate',false);
end; $$;
create or replace function public.import_canonical_sales(p_source_name text,p_checksum text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.has_role(array['information_systems']::public.app_role[]) then raise insufficient_privilege; end if;
  return public.apply_canonical_sales(p_source_name,p_checksum,p_rows);
end; $$;

create table public.integration_receipts (
  event_id text primary key,
  content_hash bytea not null,
  kind text not null,
  received_at timestamptz not null default now()
);
alter table public.integration_receipts enable row level security;
revoke all on public.integration_receipts from anon,authenticated;

create or replace function public.ingest_external_snapshot(p_event_id text,p_kind text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash bytea; v_old public.integration_receipts%rowtype; row record;
begin
  if p_event_id is null or length(p_event_id) not between 1 and 200 or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 10000 then raise exception 'Invalid event'; end if;
  if p_kind not in ('inventory','prices','sales') then raise exception 'Unknown integration kind'; end if;
  v_hash:=sha256(convert_to(p_kind||p_rows::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended(p_event_id,0));
  select * into v_old from public.integration_receipts where event_id=p_event_id;
  if found then
    if v_old.content_hash<>v_hash then raise exception 'Conflicting event replay'; end if;
    return jsonb_build_object('duplicate',true);
  end if;
  insert into public.integration_receipts(event_id,kind,content_hash) values(p_event_id,p_kind,v_hash);
  if p_kind='sales' then return public.apply_canonical_sales(p_event_id,encode(v_hash,'hex'),p_rows); end if;
  if p_kind='inventory' then
    for row in select * from jsonb_to_recordset(p_rows) as x(store_id uuid,department_id uuid,product_id uuid,quantity numeric,observed_at timestamptz,source_reference text) loop
      if row.observed_at>now() then raise exception 'Future inventory'; end if;
      insert into public.inventory_snapshots(store_id,department_id,product_id,quantity,observed_at,source_reference)
      values(row.store_id,row.department_id,row.product_id,row.quantity,row.observed_at,row.source_reference)
      on conflict(store_id,department_id,product_id) do update set quantity=excluded.quantity,observed_at=excluded.observed_at,source_reference=excluded.source_reference where excluded.observed_at>=public.inventory_snapshots.observed_at;
    end loop;
  else
    for row in select * from jsonb_to_recordset(p_rows) as x(product_id uuid,store_id uuid,price_yen integer,valid_from timestamptz,valid_until timestamptz,promotion_eligibility text) loop
      if row.promotion_eligibility not in ('eligible','excluded','not_configured') then raise exception 'Invalid price classification'; end if;
      insert into public.product_prices(product_id,store_id,price_yen,valid_from,valid_until) values(row.product_id,row.store_id,row.price_yen,row.valid_from,row.valid_until);
      update public.products set promotion_eligibility=row.promotion_eligibility,updated_at=clock_timestamp() where id=row.product_id;
    end loop;
  end if;
  return jsonb_build_object('duplicate',false,'rows',jsonb_array_length(p_rows));
end; $$;

revoke all on function public.import_app_profiles(jsonb),public.import_canonical_sales(text,text,jsonb) from public,anon;
grant execute on function public.import_app_profiles(jsonb),public.import_canonical_sales(text,text,jsonb) to authenticated;
revoke all on function public.apply_canonical_sales(text,text,jsonb),public.ingest_external_snapshot(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_external_snapshot(text,text,jsonb) to service_role;
