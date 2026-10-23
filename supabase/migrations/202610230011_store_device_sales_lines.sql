create or replace function public.store_device_sales_day_lines(
  p_token text,
  p_sales_day_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_store uuid;
  v_lines jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' or p_sales_day_id is null then
    raise exception 'Invalid device or sales day';
  end if;

  select device.store_id into v_store
  from public.store_devices device
  join public.stores store on store.id=device.store_id and store.status='active'
  where device.token_hash=sha256(convert_to(p_token,'UTF8'))
    and device.active;
  if v_store is null then
    raise exception 'Inactive or unknown device';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',line.id,
    'sales_day_id',line.sales_day_id,
    'product_code_snapshot',line.product_code_snapshot,
    'product_name_snapshot',line.product_name_snapshot,
    'department_id',line.department_id,
    'quantity',line.quantity,
    'amount_yen',line.amount_yen,
    'tax_rate',line.tax_rate,
    'transaction_time',line.transaction_time,
    'line_type',line.line_type
  ) order by line.transaction_time), '[]'::jsonb)
  into v_lines
  from public.sales_lines line
  join public.sales_days day on day.id=line.sales_day_id
  where day.id=p_sales_day_id and day.store_id=v_store;

  return v_lines;
end;
$$;

revoke all on function public.store_device_sales_day_lines(text,uuid) from public;
grant execute on function public.store_device_sales_day_lines(text,uuid) to anon,authenticated;
