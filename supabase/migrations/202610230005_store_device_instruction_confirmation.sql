alter table public.store_instruction_targets
  add column confirmed_device_id uuid references public.store_devices(id) on delete restrict;

alter table public.store_instruction_targets
  add constraint instruction_confirmation_actor_valid
  check (
    confirmed_at is null
    or (confirmed_by is null) <> (confirmed_device_id is null)
  );

create or replace function public.confirm_store_device_instruction(
  p_token text,
  p_instruction_id uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_device public.store_devices%rowtype;
begin
  if p_token is null or length(p_token)<>64 or p_token !~ '^[0-9a-f]{64}$' then
    raise insufficient_privilege;
  end if;
  select * into v_device from public.store_devices
    where token_hash=sha256(convert_to(p_token,'UTF8')) and active;
  if not found then raise insufficient_privilege; end if;
  update public.store_instruction_targets
  set confirmed_at=coalesce(confirmed_at,now()),confirmed_by=null,confirmed_device_id=v_device.id
  where instruction_id=p_instruction_id and store_id=v_device.store_id;
  if not found then raise exception 'Instruction target missing'; end if;
end;
$$;

create or replace function public.store_device_snapshot(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_store uuid; v_result jsonb;
begin
  if p_token is null or length(p_token)<>64 or p_token !~ '^[0-9a-f]{64}$' then
    raise insufficient_privilege;
  end if;
  select device.store_id into v_store
  from public.store_devices device
  join public.stores store on store.id=device.store_id and store.status='active'
  where device.token_hash=sha256(convert_to(p_token,'UTF8')) and device.active;
  if v_store is null then raise insufficient_privilege; end if;
  select jsonb_build_object(
    'store',(select jsonb_build_object('id',id,'code',code,'name',name) from public.stores where id=v_store),
    'sales',coalesce((select jsonb_agg(to_jsonb(day)) from(select id,business_date,status,net_sales_yen,customer_count from public.sales_days where store_id=v_store order by business_date desc limit 31) day),'[]'::jsonb),
    'inventory',coalesce((select jsonb_agg(to_jsonb(stock)) from(select p.code,p.name,i.quantity,i.observed_at from public.inventory_snapshots i join public.products p on p.id=i.product_id where i.store_id=v_store order by p.code limit 500) stock),'[]'::jsonb),
    'campaigns',coalesce((select jsonb_agg(to_jsonb(promo)) from(select c.id,c.name,c.starts_at,c.ends_at,c.status from public.campaigns c join public.campaign_store_targets t on t.campaign_id=c.id where t.store_id=v_store and c.status<>'draft' and not exists(select 1 from public.campaign_items i where i.campaign_id=c.id and i.eligibility_status<>'eligible') order by c.starts_at desc limit 50) promo),'[]'::jsonb),
    'instructions',coalesce((select jsonb_agg(to_jsonb(item)) from(select instruction.id,instruction.kind,instruction.title,instruction.message,instruction.product_id,instruction.price_yen,instruction.effective_at,instruction.created_at,target.store_id,target.confirmed_at,product.code product_code,product.name product_name from public.store_instructions instruction join public.store_instruction_targets target on target.instruction_id=instruction.id and target.store_id=v_store join public.products product on product.id=instruction.product_id order by instruction.effective_at desc,instruction.id desc limit 500) item),'[]'::jsonb),
    'notices',coalesce((select jsonb_agg(to_jsonb(notice)) from(select id,title,message,created_at from public.store_announcements where store_id=v_store order by created_at desc limit 100) notice),'[]'::jsonb),
    'orders',coalesce((select jsonb_agg(to_jsonb(item)) from(select id,order_date,requested_delivery_date,status from public.orders where store_id=v_store order by created_at desc limit 50) item),'[]'::jsonb),
    'salesComposition',coalesce((select jsonb_agg(to_jsonb(summary)) from(select line.product_name_snapshot name,sum(line.amount_yen) sales from public.sales_lines line join public.sales_days day on day.id=line.sales_day_id where day.store_id=v_store and day.business_date=(select max(business_date) from public.sales_days where store_id=v_store) group by line.product_code_snapshot,line.product_name_snapshot order by sales desc,line.product_code_snapshot) summary),'[]'::jsonb),
    'metrics',jsonb_build_object(
      'inventory_alert_count',(select count(*) from public.inventory_snapshots where store_id=v_store and quantity<=0),
      'notice_count',(select count(*) from public.store_announcements where store_id=v_store),
      'campaign_pending_count',(select count(*) from public.store_instruction_targets where store_id=v_store and confirmed_at is null)
    )
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.confirm_store_device_instruction(text,uuid) from public;
grant execute on function public.confirm_store_device_instruction(text,uuid) to anon,authenticated;
