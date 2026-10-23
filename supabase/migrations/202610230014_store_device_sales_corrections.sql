create or replace function public.request_store_device_sales_correction(
  p_token text,
  p_sales_day_id uuid,
  p_reason text,
  p_after_amount_yen bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.store_devices%rowtype;
  v_sales_day public.sales_days%rowtype;
  v_id uuid;
begin
  if p_token is null or length(p_token) <> 64 or p_token !~ '^[0-9a-f]{64}$' then
    raise insufficient_privilege;
  end if;
  select * into v_device from public.store_devices
    where token_hash=sha256(convert_to(p_token,'UTF8')) and active;
  if not found or v_device.created_by is null then raise insufficient_privilege; end if;
  select * into v_sales_day from public.sales_days
    where id=p_sales_day_id and store_id=v_device.store_id for update;
  if not found then raise insufficient_privilege; end if;
  if char_length(trim(coalesce(p_reason,''))) not between 1 and 500 or p_after_amount_yen < 0 then
    raise exception 'Invalid correction';
  end if;
  if v_sales_day.status='monthly_finalized' then raise exception 'Monthly finalized sales cannot be changed'; end if;
  if v_sales_day.status='imported' and public.store_business_date(v_sales_day.store_id)<>v_sales_day.business_date then
    raise exception 'Sales for a prior business date must be confirmed before requesting a correction';
  end if;
  insert into public.sales_corrections(
    sales_day_id,reason,before_amount_yen,after_amount_yen,status,requested_by
  ) values (
    v_sales_day.id,trim(p_reason),v_sales_day.net_sales_yen,p_after_amount_yen,'pending_area_approval',v_device.created_by
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.store_device_sales_corrections(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_store uuid;
begin
  if p_token is null or length(p_token)<>64 or p_token !~ '^[0-9a-f]{64}$' then raise insufficient_privilege; end if;
  select store_id into v_store from public.store_devices
    where token_hash=sha256(convert_to(p_token,'UTF8')) and active;
  if v_store is null then raise insufficient_privilege; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(item) order by item.requested_at desc)
    from (
      select correction.id,correction.sales_day_id,correction.reason,correction.before_amount_yen,
        correction.after_amount_yen,correction.status,correction.requested_at
      from public.sales_corrections correction
      join public.sales_days day on day.id=correction.sales_day_id
      where day.store_id=v_store
      order by correction.requested_at desc limit 100
    ) item
  ),'[]'::jsonb);
end;
$$;

revoke all on function public.request_store_device_sales_correction(text,uuid,text,bigint) from public;
revoke all on function public.store_device_sales_corrections(text) from public;
grant execute on function public.request_store_device_sales_correction(text,uuid,text,bigint) to anon,authenticated;
grant execute on function public.store_device_sales_corrections(text) to anon,authenticated;
