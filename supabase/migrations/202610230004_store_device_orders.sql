-- Registered store devices can place orders without an individual/admin login.
-- The device remains the auditable actor and can only order for its own store.
alter table public.orders
  add column requested_device_id uuid references public.store_devices(id) on delete restrict;

alter table public.orders alter column requested_by drop not null;

alter table public.orders
  add constraint orders_request_source_valid
  check ((requested_by is null) <> (requested_device_id is null));

create index orders_requested_device
  on public.orders(requested_device_id,created_at desc);

create or replace function public.store_device_order_workspace(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_device public.store_devices%rowtype;
begin
  if p_token is null or length(p_token)<>64 or p_token !~ '^[0-9a-f]{64}$' then
    raise insufficient_privilege;
  end if;
  select device.* into v_device
  from public.store_devices device
  join public.stores store on store.id=device.store_id and store.status='active'
  where device.token_hash=sha256(convert_to(p_token,'UTF8')) and device.active;
  if not found then raise insufficient_privilege; end if;

  return jsonb_build_object(
    'store',(select jsonb_build_object('id',id,'code',code,'name',name)
      from public.stores where id=v_device.store_id),
    'departments',coalesce((
      select jsonb_agg(to_jsonb(item) order by item.code)
      from (select id,code,name from public.store_departments
        where store_id=v_device.store_id and active order by code) item
    ),'[]'::jsonb),
    'catalog',coalesce((
      select jsonb_agg(to_jsonb(item) order by item.code)
      from (
        select product.id,product.code,product.name,product.category_code,price.price_yen
        from public.store_products stock
        join public.products product on product.id=stock.product_id and product.active
        cross join lateral (
          select candidate.price_yen
          from public.product_prices candidate
          where candidate.product_id=product.id
            and (candidate.store_id=v_device.store_id or candidate.store_id is null)
            and candidate.valid_from<=now()
            and (candidate.valid_until is null or candidate.valid_until>now())
          order by (candidate.store_id is not null) desc,candidate.valid_from desc
          limit 1
        ) price
        where stock.store_id=v_device.store_id and stock.active
        order by product.code limit 5000
      ) item
    ),'[]'::jsonb),
    'orders',coalesce((
      select jsonb_agg(to_jsonb(item) order by item.created_at desc)
      from (
        select order_header.id,order_header.order_date,order_header.requested_delivery_date,
          order_header.order_total_yen,order_header.status,order_header.created_at,
          coalesce(app_user.display_name,'店舗端末: '||source_device.name,'店舗端末') requested_name
        from public.orders order_header
        left join public.app_users app_user on app_user.id=order_header.requested_by
        left join public.store_devices source_device on source_device.id=order_header.requested_device_id
        where order_header.store_id=v_device.store_id
        order by order_header.created_at desc limit 100
      ) item
    ),'[]'::jsonb),
    'orderLines',coalesce((
      select jsonb_agg(to_jsonb(item) order by item.created_at,item.id)
      from (
        select line.id,line.order_id,line.product_id,line.quantity,line.unit_price_yen,
          line.line_total_yen,line.created_at
        from public.order_lines line
        join public.orders order_header on order_header.id=line.order_id
        where order_header.store_id=v_device.store_id
          and order_header.id in (
            select recent.id from (
              select id from public.orders where store_id=v_device.store_id
              order by created_at desc limit 100
            ) recent
          )
        order by line.created_at,line.id
      ) item
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.submit_store_device_order(
  p_token text,
  p_store_id uuid,
  p_department_id uuid,
  p_delivery_date date,
  p_items jsonb,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_device public.store_devices%rowtype;
  v_id uuid;
  v_total bigint;
  v_existing jsonb;
begin
  if p_token is null or length(p_token)<>64 or p_token !~ '^[0-9a-f]{64}$' then
    raise insufficient_privilege;
  end if;
  select device.* into v_device
  from public.store_devices device
  join public.stores store on store.id=device.store_id and store.status='active'
  where device.token_hash=sha256(convert_to(p_token,'UTF8')) and device.active;
  if not found or v_device.store_id<>p_store_id then raise insufficient_privilege; end if;
  if not exists (
    select 1 from public.store_departments department
    where department.id=p_department_id and department.store_id=v_device.store_id and department.active
  ) then raise exception 'Invalid department'; end if;
  if p_request_id is null
    or p_delivery_date is null
    or p_delivery_date<(now() at time zone 'Asia/Tokyo')::date
    or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) not between 1 and 500
  then raise exception 'Invalid order'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select payload into v_existing from public.integration_jobs
    where idempotency_key='order:'||p_request_id::text;
  if v_existing is not null then
    if v_existing->>'requestedDevice' is distinct from v_device.id::text
      or v_existing->'request' is distinct from p_items
      or v_existing->>'storeId' is distinct from p_store_id::text
      or v_existing->>'departmentId' is distinct from p_department_id::text
      or v_existing->>'deliveryDate' is distinct from p_delivery_date::text
    then raise exception 'Conflicting order replay'; end if;
    return (v_existing->>'orderId')::uuid;
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as line(product_id uuid,quantity integer)
    left join public.store_products stock
      on stock.product_id=line.product_id and stock.store_id=v_device.store_id and stock.active
    left join public.products product on product.id=line.product_id and product.active
    where line.product_id is null or line.quantity is null or line.quantity not between 1 and 99999
      or stock.product_id is null or product.id is null
      or not exists (
        select 1 from public.product_prices price
        where price.product_id=line.product_id
          and (price.store_id=v_device.store_id or price.store_id is null)
          and price.valid_from<=now() and (price.valid_until is null or price.valid_until>now())
      )
  ) then raise exception 'Invalid product, quantity or price'; end if;
  if (select count(distinct line.product_id)
      from jsonb_to_recordset(p_items) as line(product_id uuid))<>jsonb_array_length(p_items)
  then raise exception 'Duplicate product'; end if;

  select sum(line.quantity*price.price_yen) into v_total
  from jsonb_to_recordset(p_items) as line(product_id uuid,quantity integer)
  cross join lateral (
    select candidate.price_yen from public.product_prices candidate
    where candidate.product_id=line.product_id
      and (candidate.store_id=v_device.store_id or candidate.store_id is null)
      and candidate.valid_from<=now() and (candidate.valid_until is null or candidate.valid_until>now())
    order by (candidate.store_id is not null) desc,candidate.valid_from desc limit 1
  ) price;

  insert into public.orders(
    store_id,department_id,order_date,requested_delivery_date,order_total_yen,status,
    requested_by,requested_device_id
  ) values (
    v_device.store_id,p_department_id,(now() at time zone 'Asia/Tokyo')::date,
    p_delivery_date,v_total,'submitted',null,v_device.id
  ) returning id into v_id;

  insert into public.order_lines(order_id,product_id,quantity,unit_price_yen,line_total_yen)
  select v_id,line.product_id,line.quantity,price.price_yen,line.quantity*price.price_yen
  from jsonb_to_recordset(p_items) as line(product_id uuid,quantity integer)
  cross join lateral (
    select candidate.price_yen from public.product_prices candidate
    where candidate.product_id=line.product_id
      and (candidate.store_id=v_device.store_id or candidate.store_id is null)
      and candidate.valid_from<=now() and (candidate.valid_until is null or candidate.valid_until>now())
    order by (candidate.store_id is not null) desc,candidate.valid_from desc limit 1
  ) price;

  insert into public.integration_jobs(kind,idempotency_key,payload)
  values('order','order:'||p_request_id::text,jsonb_build_object(
    'version',1,'orderId',v_id,'storeId',v_device.store_id,
    'storeCode',(select code from public.stores where id=v_device.store_id),
    'departmentId',p_department_id,
    'departmentCode',(select code from public.store_departments where id=p_department_id),
    'deliveryDate',p_delivery_date,'totalYen',v_total,'request',p_items,
    'requestedBy',null,'requestedDevice',v_device.id,
    'items',(
      select jsonb_agg(jsonb_build_object(
        'productId',line.product_id,'productCode',product.code,'quantity',line.quantity,
        'unitPriceYen',price.price_yen,'lineTotalYen',line.quantity*price.price_yen
      ))
      from jsonb_to_recordset(p_items) as line(product_id uuid,quantity integer)
      join public.products product on product.id=line.product_id
      cross join lateral (
        select candidate.price_yen from public.product_prices candidate
        where candidate.product_id=line.product_id
          and (candidate.store_id=v_device.store_id or candidate.store_id is null)
          and candidate.valid_from<=now() and (candidate.valid_until is null or candidate.valid_until>now())
        order by (candidate.store_id is not null) desc,candidate.valid_from desc limit 1
      ) price
    )
  ));
  return v_id;
end;
$$;

revoke all on function public.store_device_order_workspace(text) from public;
revoke all on function public.submit_store_device_order(text,uuid,uuid,date,jsonb,uuid) from public;
grant execute on function public.store_device_order_workspace(text) to anon,authenticated;
grant execute on function public.submit_store_device_order(text,uuid,uuid,date,jsonb,uuid) to anon,authenticated;
