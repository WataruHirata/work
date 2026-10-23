-- Store staff can explicitly record the two tasks shown in the store notice:
-- POS price change and product price-label change. Authorization and campaign
-- eligibility remain enforced at the database boundary.
create or replace function public.set_campaign_item_store_task(
  p_campaign_item_id uuid,
  p_store_id uuid,
  p_task text,
  p_completed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_completed is null or p_task is null then
    raise exception 'Campaign task and completion state are required';
  end if;
  if not exists (
    select 1
    from public.user_role_assignments assignment
    join public.app_users app_user on app_user.id = assignment.user_id and app_user.active
    where assignment.user_id = (select auth.uid())
      and assignment.store_id = p_store_id
      and assignment.role in ('store_manager', 'department_lead', 'staff')
  ) then
    raise exception 'Only an assigned store user can update campaign tasks';
  end if;
  if p_task not in (
    'pos_changed', 'price_label_changed', 'pop_changed', 'display_changed',
    'price_label_restored', 'pop_restored', 'display_restored'
  ) then
    raise exception 'Unknown campaign store task';
  end if;

  update public.campaign_item_store_tasks task
  set pos_promotion_status = case when p_task = 'pos_changed' then
        case when p_completed then 'manual_confirmed' else 'not_configured' end
        else task.pos_promotion_status end,
      pos_promotion_confirmed_at = case when p_task = 'pos_changed' then
        case when p_completed then now() else null end else task.pos_promotion_confirmed_at end,
      pos_promotion_error = case when p_task = 'pos_changed' then null else task.pos_promotion_error end,
      price_label_changed_at = case when p_task = 'price_label_changed' then
        case when p_completed then now() else null end else task.price_label_changed_at end,
      price_label_changed_by = case when p_task = 'price_label_changed' then
        case when p_completed then (select auth.uid()) else null end else task.price_label_changed_by end,
      pop_changed_at = case when p_task = 'pop_changed' then
        case when p_completed then now() else null end else task.pop_changed_at end,
      pop_changed_by = case when p_task = 'pop_changed' then
        case when p_completed then (select auth.uid()) else null end else task.pop_changed_by end,
      display_changed_at = case when p_task = 'display_changed' then
        case when p_completed then now() else null end else task.display_changed_at end,
      display_changed_by = case when p_task = 'display_changed' then
        case when p_completed then (select auth.uid()) else null end else task.display_changed_by end,
      price_label_restored_at = case when p_task = 'price_label_restored' then
        case when p_completed then now() else null end else task.price_label_restored_at end,
      price_label_restored_by = case when p_task = 'price_label_restored' then
        case when p_completed then (select auth.uid()) else null end else task.price_label_restored_by end,
      pop_restored_at = case when p_task = 'pop_restored' then
        case when p_completed then now() else null end else task.pop_restored_at end,
      pop_restored_by = case when p_task = 'pop_restored' then
        case when p_completed then (select auth.uid()) else null end else task.pop_restored_by end,
      display_restored_at = case when p_task = 'display_restored' then
        case when p_completed then now() else null end else task.display_restored_at end,
      display_restored_by = case when p_task = 'display_restored' then
        case when p_completed then (select auth.uid()) else null end else task.display_restored_by end,
      updated_at = now()
  from public.campaigns campaign
  join public.campaign_items item on item.campaign_id = campaign.id
  where item.id = p_campaign_item_id
    and campaign.status in ('scheduled', 'active')
    and not exists (
      select 1
      from public.campaign_items campaign_item
      where campaign_item.campaign_id = campaign.id
        and campaign_item.eligibility_status <> 'eligible'
    )
    and (
      p_task not in ('price_label_restored', 'pop_restored', 'display_restored')
      or campaign.ends_at <= now()
    )
    and task.campaign_item_id = item.id
    and task.store_id = p_store_id;

  if not found then
    raise exception 'Campaign store task is not available';
  end if;
end;
$$;

revoke all on function public.set_campaign_item_store_task(uuid, uuid, text, boolean) from public;
grant execute on function public.set_campaign_item_store_task(uuid, uuid, text, boolean) to authenticated;
