-- FR-012/020, AT-07: source eligibility, overlap exclusion, optimistic draft edits.
create or replace function public.publish_campaign_draft(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_pair record;
begin
  if not public.has_role(array['product_office', 'information_systems']::public.app_role[]) then
    raise exception 'Only campaign administrators can publish campaigns';
  end if;
  if exists (
    select 1
    from public.campaign_items item
    where item.campaign_id = p_campaign_id
      and item.eligibility_status <> 'eligible'
  ) then
    raise exception 'Campaign products must be verified as non-EDLP before publication';
  end if;
  if exists(select 1 from public.campaign_items item join public.products product on product.id=item.product_id where item.campaign_id=p_campaign_id and (not product.active or product.promotion_eligibility<>'eligible')) then raise exception 'Campaign products must be verified as non-EDLP in the current source master'; end if;
  for v_pair in select item.product_id,target.store_id from public.campaign_items item join public.campaign_store_targets target on target.campaign_id=item.campaign_id where item.campaign_id=p_campaign_id order by item.product_id,target.store_id loop
    perform pg_advisory_xact_lock(hashtextextended(v_pair.product_id::text||':'||v_pair.store_id::text,0));
  end loop;
  if exists(
    select 1 from public.campaigns current_campaign
    join public.campaign_items current_item on current_item.campaign_id=current_campaign.id
    join public.campaign_store_targets current_target on current_target.campaign_id=current_campaign.id
    join public.campaign_items other_item on other_item.product_id=current_item.product_id and other_item.campaign_id<>current_campaign.id
    join public.campaign_store_targets other_target on other_target.campaign_id=other_item.campaign_id and other_target.store_id=current_target.store_id
    join public.campaigns other_campaign on other_campaign.id=other_item.campaign_id
    where current_campaign.id=p_campaign_id and other_campaign.status in ('scheduled','active') and other_campaign.starts_at<current_campaign.ends_at and other_campaign.ends_at>current_campaign.starts_at
  ) then raise exception 'Overlapping published campaign'; end if;
  update public.campaigns campaign
  set status = 'scheduled',
      published_at = now(),
      updated_at = now()
  where campaign.id = p_campaign_id
    and campaign.status = 'draft'
    and exists (select 1 from public.campaign_items item where item.campaign_id = campaign.id)
    and exists (
      select 1 from public.campaign_store_targets target where target.campaign_id = campaign.id
    );
  if not found then
    raise exception 'Campaign is missing products or stores, or is not a draft';
  end if;
end;
$$;

create or replace function public.edit_campaign_draft(p_campaign_id uuid,p_expected_version timestamptz,p_name text,p_starts_at timestamptz,p_ends_at timestamptz,p_prices jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare campaign public.campaigns%rowtype;
begin
  if not public.has_role(array['product_office', 'information_systems']::public.app_role[]) then raise insufficient_privilege; end if;
  select * into campaign from public.campaigns where id=p_campaign_id for update;
  if not found or campaign.status<>'draft' or campaign.published_at is not null or campaign.updated_at<>p_expected_version then raise exception 'Editable draft version required'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 200 or p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at or jsonb_typeof(p_prices) is distinct from 'array' then raise exception 'Invalid campaign draft'; end if;
  if (select count(*) from public.campaign_items where campaign_id=p_campaign_id)<>jsonb_array_length(p_prices) or (select count(distinct x.id) from jsonb_to_recordset(p_prices) as x(id uuid))<>jsonb_array_length(p_prices) then raise exception 'Every campaign item must appear exactly once'; end if;
  if exists(select 1 from jsonb_to_recordset(p_prices) as x(id uuid,price_yen integer) left join public.campaign_items i on i.id=x.id and i.campaign_id=p_campaign_id where i.id is null or x.price_yen is null or x.price_yen<0) then raise exception 'Invalid campaign prices'; end if;
  update public.campaign_items i set price_yen=x.price_yen from jsonb_to_recordset(p_prices) as x(id uuid,price_yen integer) where i.id=x.id and i.campaign_id=p_campaign_id;
  update public.campaigns set name=trim(p_name),starts_at=p_starts_at,ends_at=p_ends_at,price_yen=(select price_yen from public.campaign_items where campaign_id=p_campaign_id and product_id=campaign.product_id),updated_at=clock_timestamp() where id=p_campaign_id;
end; $$;
revoke all on function public.edit_campaign_draft(uuid,timestamptz,text,timestamptz,timestamptz,jsonb) from public,anon;
grant execute on function public.edit_campaign_draft(uuid,timestamptz,text,timestamptz,timestamptz,jsonb) to authenticated;
create trigger audit_integration_jobs after insert or update or delete on public.integration_jobs for each row execute function public.write_audit_log();
