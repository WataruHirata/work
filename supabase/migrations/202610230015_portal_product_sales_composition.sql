-- Show the latest store sales composition by product so the portal chart is reviewable.
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
    'salesComposition',coalesce((select jsonb_agg(to_jsonb(summary)) from(select line.product_name_snapshot name,sum(line.amount_yen) sales from public.sales_lines line join public.sales_days day on day.id=line.sales_day_id where day.store_id=v_store and day.business_date=(select max(business_date) from public.sales_days where store_id=v_store) group by line.product_code_snapshot,line.product_name_snapshot order by sales desc,line.product_code_snapshot) summary),'[]'::jsonb),
    'metrics',jsonb_build_object(
      'inventory_alert_count',(select count(*) from public.inventory_snapshots where store_id=v_store and quantity<=0),
      'notice_count',(select count(*) from public.store_announcements where store_id=v_store),
      'campaign_pending_count',(select count(distinct campaign.id)
        from public.campaigns campaign
        join public.campaign_store_targets target on target.campaign_id=campaign.id
        join public.campaign_items item on item.campaign_id=campaign.id and item.eligibility_status='eligible'
        left join public.campaign_item_store_tasks task on task.campaign_item_id=item.id and task.store_id=target.store_id
        where target.store_id=v_store and campaign.status<>'draft'
          and ((campaign.status='completed' and (coalesce(task.pos_restore_status,'not_configured') not in ('restored','manual_confirmed') or task.price_label_restored_at is null or task.pop_restored_at is null or task.display_restored_at is null))
            or (campaign.status<>'completed' and (coalesce(task.pos_promotion_status,'not_configured') not in ('applied','manual_confirmed') or task.price_label_changed_at is null or task.pop_changed_at is null or task.display_changed_at is null))))
    )
  ) into v_result;
  return v_result;
end; $$;

revoke all on function public.store_device_snapshot(text) from public;
grant execute on function public.store_device_snapshot(text) to anon,authenticated;
