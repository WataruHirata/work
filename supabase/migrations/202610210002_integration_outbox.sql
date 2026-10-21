-- Transactional external integration boundary. Vendor-specific mapping lives outside business UI.
create or replace function public.create_app_profile(p_user_id uuid,p_employee_code text,p_display_name text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.has_role(array['information_systems']::public.app_role[]) then raise insufficient_privilege; end if;
  if length(trim(p_employee_code)) not between 1 and 80 or length(trim(p_display_name)) not between 1 and 200 then raise exception 'Invalid profile'; end if;
  insert into public.app_users(id,employee_code,display_name,must_change_password) values(p_user_id,p_employee_code,p_display_name,true);
end; $$;
create or replace function public.disable_store_device(p_device_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.has_role(array['information_systems']::public.app_role[]) then raise insufficient_privilege; end if;
  update public.store_devices set active=false where id=p_device_id;
  if not found then raise exception 'Device missing'; end if;
end; $$;
create or replace function public.retry_integration_job(p_job_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare job public.integration_jobs%rowtype;
begin
  select * into job from public.integration_jobs where id=p_job_id for update;
  if not found or job.status<>'failed' then raise exception 'Failed job required'; end if;
  if not public.has_role(array['information_systems']::public.app_role[]) and not(job.kind in ('campaign_price','campaign_restore') and public.has_role(array['product_office']::public.app_role[])) then raise insufficient_privilege; end if;
  update public.integration_jobs set status='pending',available_at=now(),lease_id=null,locked_until=null,updated_at=now() where id=p_job_id;
end; $$;

create or replace function public.refresh_campaign_state(p_campaign_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.campaigns campaign set status='active',updated_at=now()
  where campaign.id=p_campaign_id and campaign.status='scheduled' and now()>=campaign.starts_at and now()<campaign.ends_at
    and exists(select 1 from public.campaign_items where campaign_id=campaign.id)
    and exists(select 1 from public.campaign_store_targets where campaign_id=campaign.id)
    and (select count(*) from public.campaign_items i join public.campaign_item_store_tasks t on t.campaign_item_id=i.id where i.campaign_id=campaign.id)=(select count(*) from public.campaign_items where campaign_id=campaign.id)*(select count(*) from public.campaign_store_targets where campaign_id=campaign.id)
    and not exists(select 1 from public.campaign_items i join public.campaign_item_store_tasks t on t.campaign_item_id=i.id where i.campaign_id=campaign.id and (t.pos_promotion_status not in ('applied','manual_confirmed') or t.price_label_changed_at is null or t.pop_changed_at is null or t.display_changed_at is null));
  update public.campaigns campaign set status='completed',updated_at=now()
  where campaign.id=p_campaign_id and campaign.status in ('scheduled','active') and now()>=campaign.ends_at
    and exists(select 1 from public.campaign_items where campaign_id=campaign.id)
    and exists(select 1 from public.campaign_store_targets where campaign_id=campaign.id)
    and (select count(*) from public.campaign_items i join public.campaign_item_store_tasks t on t.campaign_item_id=i.id where i.campaign_id=campaign.id)=(select count(*) from public.campaign_items where campaign_id=campaign.id)*(select count(*) from public.campaign_store_targets where campaign_id=campaign.id)
    and not exists(select 1 from public.campaign_items i join public.campaign_item_store_tasks t on t.campaign_item_id=i.id where i.campaign_id=campaign.id and (t.pos_restore_status not in ('restored','manual_confirmed') or t.price_label_restored_at is null or t.pop_restored_at is null or t.display_restored_at is null));
end; $$;
create or replace function public.campaign_task_state_changed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform public.refresh_campaign_state((select campaign_id from public.campaign_items where id=new.campaign_item_id));
  return new;
end; $$;
create trigger campaign_task_lifecycle after update on public.campaign_item_store_tasks
for each row execute function public.campaign_task_state_changed();

create or replace function public.queue_due_integrations()
returns void language plpgsql security definer set search_path='' as $$
begin
  insert into public.integration_jobs(kind,idempotency_key,payload,available_at)
  select 'campaign_price','campaign_price:'||c.id||':'||i.id||':'||t.store_id,
    jsonb_build_object('version',1,'campaignId',c.id,'itemId',i.id,'productId',i.product_id,'productCode',(select code from public.products where id=i.product_id),'storeId',t.store_id,'storeCode',(select code from public.stores where id=t.store_id),'priceYen',i.price_yen,'startsAt',c.starts_at,'endsAt',c.ends_at),c.starts_at
  from public.campaigns c join public.campaign_items i on i.campaign_id=c.id join public.campaign_store_targets t on t.campaign_id=c.id
  where c.status='scheduled' and c.published_at is not null and now()<c.ends_at and i.eligibility_status='eligible'
  on conflict(idempotency_key) do nothing;
  insert into public.integration_jobs(kind,idempotency_key,payload,available_at)
  select 'campaign_restore','campaign_restore:'||c.id||':'||i.id||':'||t.store_id,
    jsonb_build_object('version',1,'campaignId',c.id,'itemId',i.id,'productId',i.product_id,'productCode',(select code from public.products where id=i.product_id),'storeId',t.store_id,'storeCode',(select code from public.stores where id=t.store_id),'priceYen',null,'endsAt',c.ends_at),now()
  from public.campaigns c join public.campaign_items i on i.campaign_id=c.id join public.campaign_store_targets t on t.campaign_id=c.id
  where c.status in ('scheduled','active') and now()>=c.ends_at and i.eligibility_status='eligible'
  on conflict(idempotency_key) do nothing;
end; $$;

create or replace function public.claim_integration_jobs(p_kinds text[],p_limit integer default 10)
returns setof public.integration_jobs language plpgsql security definer set search_path='' as $$
begin
  if p_limit not between 1 and 20 then raise exception 'Invalid batch size'; end if;
  perform public.queue_due_integrations();
  return query with selected as (
    select id from public.integration_jobs where kind=any(p_kinds) and available_at<=now()
      and (status='pending' or (status='processing' and locked_until<now()))
    order by available_at for update skip locked limit p_limit
  ) update public.integration_jobs job set status='processing',attempts=attempts+1,lease_id=gen_random_uuid(),locked_until=now()+interval '2 minutes',updated_at=now()
    from selected where job.id=selected.id returning job.*;
end; $$;

create or replace function public.finish_integration_job(p_job_id uuid,p_lease_id uuid,p_success boolean,p_result jsonb default null,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
declare job public.integration_jobs%rowtype; target_store uuid; campaign_id uuid;
begin
  select * into job from public.integration_jobs where id=p_job_id and lease_id=p_lease_id and status='processing' and locked_until>=now() for update;
  if p_success is null then raise exception 'Integration outcome required'; end if;
  if not found then raise exception 'Stale integration lease'; end if;
  update public.integration_jobs set status=case when p_success then 'completed' else 'failed' end,result=p_result,last_error=case when p_success then null else left(p_error,500) end,lease_id=null,locked_until=null,updated_at=now() where id=p_job_id;
  if job.kind='order' then
    update public.orders set status=case when p_success then 'sent' else 'failed' end,updated_at=now() where id=(job.payload->>'orderId')::uuid;
  elsif job.kind in ('campaign_price','campaign_restore') then
    target_store:=(job.payload->>'storeId')::uuid;
    campaign_id:=(job.payload->>'campaignId')::uuid;
    if job.kind='campaign_price' then
      update public.campaign_item_store_tasks set pos_promotion_status=case when p_success then 'applied' else 'failed' end,pos_promotion_confirmed_at=case when p_success then now() else null end,pos_promotion_error=case when p_success then null else left(p_error,500) end,updated_at=now() where campaign_item_id=(job.payload->>'itemId')::uuid and store_id=target_store;
    else
      update public.campaign_item_store_tasks set pos_restore_status=case when p_success then 'restored' else 'failed' end,pos_restored_at=case when p_success then now() else null end,pos_restore_error=case when p_success then null else left(p_error,500) end,updated_at=now() where campaign_item_id=(job.payload->>'itemId')::uuid and store_id=target_store;
    end if;
    perform public.refresh_campaign_state(campaign_id);
  end if;
  if not p_success then
    insert into public.notifications(user_id,notification_type,title,message)
    select distinct a.user_id,'integration_failed','外部連携に失敗しました','連携監視で対象とエラーを確認し、再処理してください。ジョブ: '||p_job_id::text
    from public.user_role_assignments a join public.app_users u on u.id=a.user_id and u.active
    where a.role in ('information_systems','product_office','store_operations') or (a.store_id=target_store);
    if target_store is not null then
      insert into public.store_announcements(store_id,title,message) values(target_store,'価格連携の確認が必要です','POS連携または通常売価への復帰に失敗しました。本部へ確認してください。');
    end if;
  end if;
end; $$;

-- Read the latest authoritative price cache at execution time, never at publication time.
create or replace function public.resolve_restore_price(p_product_id uuid,p_store_id uuid)
returns integer language sql stable security definer set search_path='' as $$
 -- Q-17: do not invent precedence between a store price and a global price.
 -- Latest effective records in each scope must agree, otherwise resolution fails closed.
 select case when count(distinct price_yen)=1 then min(price_yen) else null end
 from public.product_prices candidate
 where candidate.product_id=p_product_id and (candidate.store_id=p_store_id or candidate.store_id is null)
   and candidate.valid_from<=now() and (candidate.valid_until is null or candidate.valid_until>now())
   and candidate.valid_from=(select max(other.valid_from) from public.product_prices other where other.product_id=p_product_id and other.store_id is not distinct from candidate.store_id and other.valid_from<=now() and (other.valid_until is null or other.valid_until>now()));
$$;

revoke all on function public.create_app_profile(uuid,text,text),public.disable_store_device(uuid),public.retry_integration_job(uuid) from public,anon;
grant execute on function public.create_app_profile(uuid,text,text),public.disable_store_device(uuid),public.retry_integration_job(uuid) to authenticated;
revoke all on function public.refresh_campaign_state(uuid),public.campaign_task_state_changed(),public.queue_due_integrations(),public.claim_integration_jobs(text[],integer),public.finish_integration_job(uuid,uuid,boolean,jsonb,text),public.resolve_restore_price(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_integration_jobs(text[],integer),public.finish_integration_job(uuid,uuid,boolean,jsonb,text),public.resolve_restore_price(uuid,uuid) to service_role;
