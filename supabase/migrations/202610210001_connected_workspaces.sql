-- FR-014/025/026/028/029/030/032..039, AT-04/05/09/10.
-- Additive application schema; existing business rows are preserved.
alter table public.stores add column opening_time time not null default '09:00';
alter table public.app_users add column employee_code text unique;
alter table public.app_users add column affiliation text;
alter table public.app_users add column must_change_password boolean not null default false;
alter table public.products add column promotion_eligibility text not null default 'not_configured'
  check (promotion_eligibility in ('not_configured', 'eligible', 'excluded'));

create table public.inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  department_id uuid not null,
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null,
  observed_at timestamptz not null,
  source_reference text not null,
  foreign key (store_id, department_id) references public.store_departments(store_id,id),
  unique(store_id,department_id,product_id)
);
create table public.store_announcements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  title text not null check(length(trim(title)) between 1 and 200),
  message text not null check(length(trim(message)) between 1 and 2000),
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.store_devices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  name text not null check(length(trim(name)) between 1 and 100),
  token_hash bytea not null unique,
  active boolean not null default true,
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now()
);
create table public.integration_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in ('order','campaign_price','campaign_restore','sales_import')),
  idempotency_key text not null unique,
  payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','processing','completed','failed')),
  attempts integer not null default 0,
  lease_id uuid,
  locked_until timestamptz,
  available_at timestamptz not null default now(),
  last_error text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index integration_jobs_pending on public.integration_jobs(status,available_at);

alter table public.inventory_snapshots enable row level security;
alter table public.store_announcements enable row level security;
alter table public.store_devices enable row level security;
alter table public.integration_jobs enable row level security;
create policy inventory_read_scoped on public.inventory_snapshots for select to authenticated
  using(public.can_access_department(store_id,department_id));
create policy announcements_read_scoped on public.store_announcements for select to authenticated
  using(public.can_view_store(store_id));
create policy devices_read_admin on public.store_devices for select to authenticated
  using(public.has_role(array['information_systems']::public.app_role[]));
create policy jobs_read_admin on public.integration_jobs for select to authenticated
  using(public.has_role(array['information_systems','store_operations','product_office']::public.app_role[]));
grant select on public.inventory_snapshots,public.store_announcements,public.store_devices,public.integration_jobs to authenticated;
revoke all on public.store_devices from anon;
revoke insert,update,delete on public.inventory_snapshots,public.store_announcements,public.store_devices,public.integration_jobs from anon,authenticated;
-- Token digests never leave the trusted database.
revoke select on public.store_devices from authenticated;
grant select(id,store_id,name,active,created_by,created_at) on public.store_devices to authenticated;

create trigger audit_announcement_changes after insert or update or delete on public.store_announcements
  for each row execute function public.write_audit_log();
-- Device secrets (including digests) must not be copied into audit payloads.

create or replace function public.save_business_master(p_resource text,p_id uuid,p_values jsonb,p_expected_version timestamptz default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_version timestamptz;
begin
  if p_resource='products' then
    if not public.has_role(array['product_office']::public.app_role[]) then raise insufficient_privilege; end if;
    if p_values->>'code' is null or length(trim(p_values->>'code'))=0 or p_values->>'name' is null then raise exception 'Product fields required'; end if;
    if p_id is null then
      insert into public.products(code,name,category_code,tax_rate,active)
      values(p_values->>'code',p_values->>'name',p_values->>'category_code',(p_values->>'tax_rate')::numeric,(p_values->>'active')::boolean) returning id into v_id;
    else
      update public.products set code=p_values->>'code',name=p_values->>'name',category_code=p_values->>'category_code',tax_rate=(p_values->>'tax_rate')::numeric,active=(p_values->>'active')::boolean,updated_at=clock_timestamp()
      where id=p_id and updated_at=p_expected_version returning id into v_id;
    end if;
  elsif p_resource='stores' then
    if not public.has_role(array['information_systems']::public.app_role[]) then raise insufficient_privilege; end if;
    if p_id is null then
      insert into public.stores(code,name,area_id,timezone,opening_time,closing_time,business_day_starts_at,status,has_dine_in,opened_on)
      values(p_values->>'code',p_values->>'name',(p_values->>'area_id')::uuid,'Asia/Tokyo',(p_values->>'opening_time')::time,(p_values->>'closing_time')::time,(p_values->>'business_day_starts_at')::time,(p_values->>'status')::public.store_status,(p_values->>'has_dine_in')::boolean,(p_values->>'opened_on')::date) returning id into v_id;
    else
      update public.stores set code=p_values->>'code',name=p_values->>'name',area_id=(p_values->>'area_id')::uuid,opening_time=(p_values->>'opening_time')::time,closing_time=(p_values->>'closing_time')::time,business_day_starts_at=(p_values->>'business_day_starts_at')::time,status=(p_values->>'status')::public.store_status,has_dine_in=(p_values->>'has_dine_in')::boolean,opened_on=(p_values->>'opened_on')::date,updated_at=clock_timestamp()
      where id=p_id and updated_at=p_expected_version returning id into v_id;
    end if;
  elsif p_resource='users' then
    if not public.has_role(array['information_systems']::public.app_role[]) then raise insufficient_privilege; end if;
    -- Avoid accidental loss of the last active information-systems administrator.
    perform pg_advisory_xact_lock(210001);
    if p_id=(select auth.uid()) and not (p_values->>'active')::boolean then raise exception 'Cannot disable own account'; end if;
    if p_id is null then raise exception 'Create the auth identity first'; end if;
    update public.app_users set employee_code=p_values->>'employee_code',display_name=p_values->>'display_name',affiliation=p_values->>'affiliation',active=(p_values->>'active')::boolean,updated_at=clock_timestamp()
    where id=p_id and updated_at=p_expected_version returning id into v_id;
  elsif p_resource='announcements' then
    if not public.has_role(array['information_systems']::public.app_role[]) then raise insufficient_privilege; end if;
    if p_id is null then
      insert into public.store_announcements(store_id,title,message,created_by) values((p_values->>'store_id')::uuid,p_values->>'title',p_values->>'message',(select auth.uid())) returning id into v_id;
    else
      update public.store_announcements set title=p_values->>'title',message=p_values->>'message',updated_at=clock_timestamp()
      where id=p_id and store_id=(p_values->>'store_id')::uuid and updated_at=p_expected_version returning id into v_id;
    end if;
  else raise exception 'Unknown master'; end if;
  if v_id is null then raise exception 'Concurrent modification or missing record'; end if;
  return v_id;
end; $$;

create or replace function public.assign_app_role(p_user_id uuid,p_role public.app_role,p_area_id uuid default null,p_store_id uuid default null,p_department_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not public.has_role(array['information_systems']::public.app_role[]) then raise insufficient_privilege; end if;
  if not exists(select 1 from public.app_users where id=p_user_id and active) then raise exception 'Active user required'; end if;
  insert into public.user_role_assignments(user_id,role,area_id,store_id,department_id,assigned_by)
  values(p_user_id,p_role,p_area_id,p_store_id,p_department_id,(select auth.uid())) returning id into v_id;
  return v_id;
end; $$;
create or replace function public.revoke_app_role(p_assignment_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.has_role(array['information_systems']::public.app_role[]) then raise insufficient_privilege; end if;
  perform pg_advisory_xact_lock(210001);
  if exists(select 1 from public.user_role_assignments where id=p_assignment_id and user_id=(select auth.uid())) then raise exception 'Cannot revoke own assignment'; end if;
  delete from public.user_role_assignments where id=p_assignment_id;
  if not found then raise exception 'Assignment missing'; end if;
end; $$;

create or replace function public.submit_store_order(p_store_id uuid,p_department_id uuid,p_delivery_date date,p_items jsonb,p_request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not public.can_access_department(p_store_id,p_department_id,array['staff','department_lead','store_manager']::public.app_role[]) then raise insufficient_privilege; end if;
  if p_request_id is null or p_delivery_date is null or p_delivery_date < (now() at time zone 'Asia/Tokyo')::date or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Invalid order'; end if;
  if jsonb_array_length(p_items) not between 1 and 500 then raise exception 'Invalid line count'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select (payload->>'orderId')::uuid into v_id from public.integration_jobs where idempotency_key='order:'||p_request_id::text and payload->>'requestedBy'=(select auth.uid())::text;
  if v_id is not null then
    if not exists(select 1 from public.integration_jobs where idempotency_key='order:'||p_request_id::text and payload->'request'=p_items and payload->>'storeId'=p_store_id::text and payload->>'departmentId'=p_department_id::text and payload->>'deliveryDate'=p_delivery_date::text) then raise exception 'Conflicting order replay'; end if;
    return v_id;
  end if;
  if exists(select 1 from jsonb_to_recordset(p_items) as line(product_id uuid,quantity integer) left join public.store_products sp on sp.product_id=line.product_id and sp.store_id=p_store_id and sp.active left join public.products product on product.id=line.product_id and product.active where line.product_id is null or line.quantity is null or line.quantity not between 1 and 99999 or sp.product_id is null or product.id is null) then raise exception 'Invalid product or quantity'; end if;
  if (select count(distinct line.product_id) from jsonb_to_recordset(p_items) as line(product_id uuid)) <> jsonb_array_length(p_items) then raise exception 'Duplicate product'; end if;
  insert into public.orders(store_id,department_id,order_date,requested_delivery_date,status,requested_by)
  values(p_store_id,p_department_id,(now() at time zone 'Asia/Tokyo')::date,p_delivery_date,'submitted',(select auth.uid())) returning id into v_id;
  insert into public.order_lines(order_id,product_id,quantity) select v_id,line.product_id,line.quantity from jsonb_to_recordset(p_items) as line(product_id uuid,quantity integer);
  insert into public.integration_jobs(kind,idempotency_key,payload) values('order','order:'||p_request_id::text,jsonb_build_object('version',1,'orderId',v_id,'storeId',p_store_id,'storeCode',(select code from public.stores where id=p_store_id),'departmentId',p_department_id,'departmentCode',(select code from public.store_departments where id=p_department_id),'deliveryDate',p_delivery_date,'request',p_items,'items',(select jsonb_agg(jsonb_build_object('productId',line.product_id,'productCode',product.code,'quantity',line.quantity)) from jsonb_to_recordset(p_items) as line(product_id uuid,quantity integer) join public.products product on product.id=line.product_id),'requestedBy',(select auth.uid())));
  return v_id;
end; $$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and user_id=(select auth.uid());
  if not found then raise insufficient_privilege; end if;
end; $$;

create or replace function public.register_store_device(p_store_id uuid,p_name text,p_token text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not public.has_role(array['information_systems']::public.app_role[]) then raise insufficient_privilege; end if;
  if length(p_token)<>64 or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Invalid device token'; end if;
  insert into public.store_devices(store_id,name,token_hash,created_by) values(p_store_id,p_name,sha256(convert_to(p_token,'UTF8')),(select auth.uid())) returning id into v_id;
  return v_id;
end; $$;
create or replace function public.store_device_snapshot(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_store uuid; v_result jsonb;
begin
  if p_token is null or length(p_token)<>64 then raise insufficient_privilege; end if;
  select store_id into v_store from public.store_devices where token_hash=sha256(convert_to(p_token,'UTF8')) and active;
  if v_store is null then raise insufficient_privilege; end if;
  select jsonb_build_object(
    'store',(select jsonb_build_object('id',id,'code',code,'name',name) from public.stores where id=v_store),
    'sales',coalesce((select jsonb_agg(to_jsonb(day)) from(select id,business_date,status,net_sales_yen,customer_count from public.sales_days where store_id=v_store order by business_date desc limit 31) day),'[]'::jsonb),
    'inventory',coalesce((select jsonb_agg(to_jsonb(stock)) from(select p.code,p.name,i.quantity,i.observed_at from public.inventory_snapshots i join public.products p on p.id=i.product_id where i.store_id=v_store order by p.code limit 500) stock),'[]'::jsonb),
    'campaigns',coalesce((select jsonb_agg(to_jsonb(promo)) from(select c.id,c.name,c.starts_at,c.ends_at,c.status from public.campaigns c join public.campaign_store_targets t on t.campaign_id=c.id where t.store_id=v_store and c.status<>'draft' and not exists(select 1 from public.campaign_items i where i.campaign_id=c.id and i.eligibility_status<>'eligible') order by c.starts_at desc limit 50) promo),'[]'::jsonb),
    'notices',coalesce((select jsonb_agg(to_jsonb(notice)) from(select id,title,message,created_at from public.store_announcements where store_id=v_store order by created_at desc limit 100) notice),'[]'::jsonb),
    'orders',coalesce((select jsonb_agg(to_jsonb(item)) from(select id,order_date,requested_delivery_date,status from public.orders where store_id=v_store order by created_at desc limit 50) item),'[]'::jsonb),
    'departments',coalesce((select jsonb_agg(to_jsonb(summary)) from(select department.name,sum(line.amount_yen) sales from public.sales_lines line join public.sales_days day on day.id=line.sales_day_id join public.store_departments department on department.id=line.department_id where day.store_id=v_store and day.business_date=(select max(business_date) from public.sales_days where store_id=v_store) group by department.id,department.name) summary),'[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;

create or replace function public.verify_campaign_product(p_campaign_item_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.has_role(array['product_office']::public.app_role[]) then raise insufficient_privilege; end if;
  update public.campaign_items item set eligibility_status=product.promotion_eligibility
  from public.products product,public.campaigns campaign
  where item.id=p_campaign_item_id and product.id=item.product_id and campaign.id=item.campaign_id and campaign.status='draft';
  if not found then raise exception 'Editable draft required'; end if;
end; $$;

-- Public functions are not implicitly executable by anonymous clients.
revoke all on function public.save_business_master(text,uuid,jsonb,timestamptz) from public,anon;
revoke all on function public.assign_app_role(uuid,public.app_role,uuid,uuid,uuid) from public,anon;
revoke all on function public.revoke_app_role(uuid) from public,anon;
revoke all on function public.submit_store_order(uuid,uuid,date,jsonb,uuid) from public,anon;
revoke all on function public.mark_notification_read(uuid) from public,anon;
revoke all on function public.register_store_device(uuid,text,text) from public,anon;
revoke all on function public.verify_campaign_product(uuid) from public,anon;
revoke all on function public.store_device_snapshot(text) from public;
grant execute on function public.save_business_master(text,uuid,jsonb,timestamptz),public.assign_app_role(uuid,public.app_role,uuid,uuid,uuid),public.revoke_app_role(uuid),public.submit_store_order(uuid,uuid,date,jsonb,uuid),public.mark_notification_read(uuid),public.register_store_device(uuid,text,text),public.verify_campaign_product(uuid) to authenticated;
grant execute on function public.store_device_snapshot(text) to anon,authenticated;

-- Auth provider owns password verification. Only an actual encrypted password change clears the flag.
create or replace function public.password_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.app_users set must_change_password=false,updated_at=clock_timestamp() where id=new.id;
  end if;
  return new;
end; $$;
do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='encrypted_password') then
    execute 'create trigger app_password_changed after update of encrypted_password on auth.users for each row execute function public.password_changed()';
  end if;
end; $$;
revoke all on function public.password_changed() from public,anon,authenticated;
