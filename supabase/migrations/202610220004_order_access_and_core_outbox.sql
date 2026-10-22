-- Any active signed-in account may create a development order. Store, department,
-- product, price and idempotency checks remain enforced at the server boundary.
create or replace function public.submit_store_order(
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
  v_user_id uuid := (select auth.uid());
  v_id uuid;
  v_total bigint;
  v_existing jsonb;
begin
  if v_user_id is null or not exists (
    select 1 from public.app_users where id=v_user_id and active
  ) then
    raise insufficient_privilege;
  end if;
  if not exists (
    select 1
    from public.stores store
    join public.store_departments department
      on department.store_id=store.id
     and department.id=p_department_id
     and department.active
    where store.id=p_store_id and store.status='active'
  ) then
    raise exception 'Invalid store or department';
  end if;
  if p_request_id is null
    or p_delivery_date is null
    or p_delivery_date < (now() at time zone 'Asia/Tokyo')::date
    or jsonb_typeof(p_items) is distinct from 'array'
  then
    raise exception 'Invalid order';
  end if;
  if jsonb_array_length(p_items) not between 1 and 500 then
    raise exception 'Invalid line count';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select payload into v_existing
  from public.integration_jobs
  where idempotency_key='order:'||p_request_id::text;
  if v_existing is not null then
    if v_existing->>'requestedBy' is distinct from v_user_id::text
      or v_existing->'request' is distinct from p_items
      or v_existing->>'storeId' is distinct from p_store_id::text
      or v_existing->>'departmentId' is distinct from p_department_id::text
      or v_existing->>'deliveryDate' is distinct from p_delivery_date::text
    then
      raise exception 'Conflicting order replay';
    end if;
    return (v_existing->>'orderId')::uuid;
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as line(product_id uuid,quantity integer)
    left join public.store_products stock
      on stock.product_id=line.product_id and stock.store_id=p_store_id and stock.active
    left join public.products product on product.id=line.product_id and product.active
    where line.product_id is null
      or line.quantity is null
      or line.quantity not between 1 and 99999
      or stock.product_id is null
      or product.id is null
      or not exists (
        select 1 from public.product_prices price
        where price.product_id=line.product_id
          and (price.store_id=p_store_id or price.store_id is null)
          and price.valid_from<=now()
          and (price.valid_until is null or price.valid_until>now())
      )
  ) then
    raise exception 'Invalid product, quantity or price';
  end if;
  if (
    select count(distinct line.product_id)
    from jsonb_to_recordset(p_items) as line(product_id uuid)
  ) <> jsonb_array_length(p_items) then
    raise exception 'Duplicate product';
  end if;

  select sum(line.quantity*price.price_yen)
  into v_total
  from jsonb_to_recordset(p_items) as line(product_id uuid,quantity integer)
  cross join lateral (
    select candidate.price_yen
    from public.product_prices candidate
    where candidate.product_id=line.product_id
      and (candidate.store_id=p_store_id or candidate.store_id is null)
      and candidate.valid_from<=now()
      and (candidate.valid_until is null or candidate.valid_until>now())
    order by (candidate.store_id is not null) desc,candidate.valid_from desc
    limit 1
  ) price;

  insert into public.orders(
    store_id,department_id,order_date,requested_delivery_date,
    order_total_yen,status,requested_by
  ) values(
    p_store_id,p_department_id,(now() at time zone 'Asia/Tokyo')::date,
    p_delivery_date,v_total,'submitted',v_user_id
  ) returning id into v_id;

  insert into public.order_lines(
    order_id,product_id,quantity,unit_price_yen,line_total_yen
  )
  select v_id,line.product_id,line.quantity,price.price_yen,line.quantity*price.price_yen
  from jsonb_to_recordset(p_items) as line(product_id uuid,quantity integer)
  cross join lateral (
    select candidate.price_yen
    from public.product_prices candidate
    where candidate.product_id=line.product_id
      and (candidate.store_id=p_store_id or candidate.store_id is null)
      and candidate.valid_from<=now()
      and (candidate.valid_until is null or candidate.valid_until>now())
    order by (candidate.store_id is not null) desc,candidate.valid_from desc
    limit 1
  ) price;

  insert into public.integration_jobs(kind,idempotency_key,payload)
  values(
    'order',
    'order:'||p_request_id::text,
    jsonb_build_object(
      'version',1,
      'orderId',v_id,
      'storeId',p_store_id,
      'storeCode',(select code from public.stores where id=p_store_id),
      'departmentId',p_department_id,
      'departmentCode',(select code from public.store_departments where id=p_department_id),
      'deliveryDate',p_delivery_date,
      'totalYen',v_total,
      'request',p_items,
      'items',(
        select jsonb_agg(jsonb_build_object(
          'productId',line.product_id,
          'productCode',product.code,
          'quantity',line.quantity,
          'unitPriceYen',price.price_yen,
          'lineTotalYen',line.quantity*price.price_yen
        ))
        from jsonb_to_recordset(p_items) as line(product_id uuid,quantity integer)
        join public.products product on product.id=line.product_id
        cross join lateral (
          select candidate.price_yen
          from public.product_prices candidate
          where candidate.product_id=line.product_id
            and (candidate.store_id=p_store_id or candidate.store_id is null)
            and candidate.valid_from<=now()
            and (candidate.valid_until is null or candidate.valid_until>now())
          order by (candidate.store_id is not null) desc,candidate.valid_from desc
          limit 1
        ) price
      ),
      'requestedBy',v_user_id
    )
  );
  return v_id;
end;
$$;
