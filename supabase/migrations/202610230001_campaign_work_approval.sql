-- A store records the POS and price-label tasks; product office then accepts that work.
alter table public.campaign_item_store_tasks
  add column work_approved_at timestamptz,
  add column work_approved_by uuid references public.app_users(id) on delete set null;

create or replace function public.clear_campaign_work_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pos_promotion_status is distinct from old.pos_promotion_status
    or new.price_label_changed_at is distinct from old.price_label_changed_at then
    new.work_approved_at := null;
    new.work_approved_by := null;
  end if;
  return new;
end;
$$;

create trigger clear_campaign_work_approval_on_task_change
  before update of pos_promotion_status, price_label_changed_at
  on public.campaign_item_store_tasks
  for each row execute function public.clear_campaign_work_approval();

create or replace function public.approve_campaign_store_work(
  p_campaign_item_id uuid,
  p_store_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['product_office', 'information_systems']::public.app_role[]) then
    raise exception 'Only campaign administrators can approve campaign work';
  end if;

  update public.campaign_item_store_tasks task
  set work_approved_at = now(),
      work_approved_by = (select auth.uid()),
      updated_at = now()
  where task.campaign_item_id = p_campaign_item_id
    and task.store_id = p_store_id
    and task.work_approved_at is null
    and task.pos_promotion_status in ('applied', 'manual_confirmed')
    and task.price_label_changed_at is not null
    and exists (
      select 1
      from public.campaign_items item
      join public.campaigns campaign on campaign.id = item.campaign_id
      where item.id = task.campaign_item_id
        and campaign.status in ('scheduled', 'active')
    );

  if not found then
    raise exception 'Campaign store work is incomplete or unavailable';
  end if;
end;
$$;

revoke all on function public.approve_campaign_store_work(uuid, uuid) from public;
grant execute on function public.approve_campaign_store_work(uuid, uuid) to authenticated;

-- The documented demo administrator can inspect the campaign screen without gaining mutation rights.
create or replace function public.can_view_campaign(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(array['product_office', 'information_systems']::public.app_role[])
    or exists (
      select 1
      from public.campaigns campaign
      join public.campaign_store_targets target on target.campaign_id = campaign.id
      where campaign.id = p_campaign_id
        and campaign.status <> 'draft'
        and not exists (
          select 1
          from public.campaign_items item
          where item.campaign_id = campaign.id
            and item.eligibility_status <> 'eligible'
        )
        and public.can_view_store(target.store_id)
    );
$$;

drop policy campaign_item_store_tasks_read_scoped on public.campaign_item_store_tasks;
create policy campaign_item_store_tasks_read_scoped on public.campaign_item_store_tasks
  for select to authenticated using (
    public.has_role(array['product_office', 'information_systems']::public.app_role[])
    or (
      public.can_view_store(store_id)
      and exists (
        select 1 from public.campaign_items item
        where item.id = campaign_item_store_tasks.campaign_item_id
          and public.can_view_campaign(item.campaign_id)
      )
    )
  );
