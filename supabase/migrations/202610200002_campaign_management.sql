create table public.campaign_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  price_yen integer not null check (price_yen >= 0),
  eligibility_status text not null default 'not_configured'
    check (eligibility_status in ('not_configured', 'eligible', 'excluded')),
  created_at timestamptz not null default now(),
  unique (campaign_id, product_id),
  unique (campaign_id, id)
);

insert into public.campaign_items (campaign_id, product_id, price_yen)
select id, product_id, price_yen from public.campaigns;

alter table public.campaigns
  add column published_at timestamptz;

alter table public.campaign_store_targets
  add column store_confirmed_at timestamptz,
  add column store_confirmed_by uuid references public.app_users(id) on delete set null;

create table public.campaign_item_store_tasks (
  campaign_item_id uuid not null references public.campaign_items(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  pos_promotion_status text not null default 'not_configured'
    check (pos_promotion_status in ('not_configured', 'pending', 'applied', 'failed', 'manual_confirmed')),
  pos_promotion_confirmed_at timestamptz,
  pos_promotion_error text,
  price_label_changed_at timestamptz,
  price_label_changed_by uuid references public.app_users(id) on delete set null,
  pop_changed_at timestamptz,
  pop_changed_by uuid references public.app_users(id) on delete set null,
  display_changed_at timestamptz,
  display_changed_by uuid references public.app_users(id) on delete set null,
  pos_restore_status text not null default 'not_configured'
    check (pos_restore_status in ('not_configured', 'pending', 'restored', 'failed', 'manual_confirmed')),
  pos_restored_at timestamptz,
  pos_restore_error text,
  price_label_restored_at timestamptz,
  price_label_restored_by uuid references public.app_users(id) on delete set null,
  pop_restored_at timestamptz,
  pop_restored_by uuid references public.app_users(id) on delete set null,
  display_restored_at timestamptz,
  display_restored_by uuid references public.app_users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (campaign_item_id, store_id)
);
create index campaign_item_store_tasks_store on public.campaign_item_store_tasks(store_id, campaign_item_id);

insert into public.campaign_item_store_tasks (campaign_item_id, store_id)
select item.id, target.store_id
from public.campaign_items item
join public.campaign_store_targets target on target.campaign_id = item.campaign_id;

create trigger audit_campaign_item_changes after insert or update or delete on public.campaign_items
  for each row execute function public.write_audit_log();
create trigger audit_campaign_item_store_task_changes
  after insert or update or delete on public.campaign_item_store_tasks
  for each row execute function public.write_audit_log();

create or replace function public.can_view_campaign(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(array['product_office']::public.app_role[])
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

revoke all on function public.can_view_campaign(uuid) from public;
grant execute on function public.can_view_campaign(uuid) to authenticated;

drop policy campaigns_read_authenticated on public.campaigns;
drop policy campaigns_insert_product_office on public.campaigns;
drop policy campaigns_update_product_office on public.campaigns;
create policy campaigns_read_scoped on public.campaigns for select to authenticated using (
  public.can_view_campaign(id)
);

drop policy campaign_targets_read_scoped on public.campaign_store_targets;
drop policy campaign_targets_manage_product_office on public.campaign_store_targets;
create policy campaign_targets_read_scoped on public.campaign_store_targets for select to authenticated
  using (
    public.can_view_campaign(campaign_id)
  );

alter table public.campaign_items enable row level security;
alter table public.campaign_item_store_tasks enable row level security;
create policy campaign_items_read_scoped on public.campaign_items for select to authenticated using (
  public.can_view_campaign(campaign_id)
);
create policy campaign_item_store_tasks_read_scoped on public.campaign_item_store_tasks
  for select to authenticated using (
    public.has_role(array['product_office']::public.app_role[])
    or (
      public.can_view_store(store_id)
      and exists (
        select 1 from public.campaign_items item
        where item.id = campaign_item_store_tasks.campaign_item_id
          and public.can_view_campaign(item.campaign_id)
      )
    )
  );

drop policy stores_read_authorized on public.stores;
create policy stores_read_authorized on public.stores for select to authenticated using (
  public.has_role(array['product_office', 'information_systems']::public.app_role[])
  or public.can_view_store(id)
);

revoke insert, update, delete on public.campaigns from authenticated;
revoke insert, update, delete on public.campaign_store_targets from authenticated;
revoke insert, update, delete on public.campaign_items from authenticated;
revoke insert, update, delete on public.campaign_item_store_tasks from authenticated;

create or replace function public.create_campaign_draft(
  p_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_items jsonb,
  p_store_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  first_product_id uuid;
  first_price_yen integer;
  item_count integer;
  active_product_count integer;
  active_store_count integer;
begin
  if not public.has_role(array['product_office']::public.app_role[]) then
    raise exception 'Only product office users can create campaigns';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Campaign name is required';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'Campaign end must be after its start';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Campaign products must be a JSON array';
  end if;
  if jsonb_array_length(p_items) < 1 then
    raise exception 'Campaigns must contain at least one product';
  end if;
  if p_store_ids is null then
    raise exception 'Campaign stores are required';
  end if;
  if cardinality(p_store_ids) not between 1 and 112 then
    raise exception 'Campaigns must target between 1 and 112 stores';
  end if;
  if (select count(distinct store_id) from unnest(p_store_ids) as selected(store_id))
      <> cardinality(p_store_ids) then
    raise exception 'Campaign store targets must be unique';
  end if;

  select count(*)
  into item_count
  from jsonb_to_recordset(p_items) as item(product_id uuid, price_yen integer);
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(product_id uuid, price_yen integer)
    where item.product_id is null or item.price_yen is null or item.price_yen < 0
  ) or item_count <> jsonb_array_length(p_items) then
    raise exception 'Campaign products and non-negative prices are required';
  end if;
  if exists (
    select item.product_id
    from jsonb_to_recordset(p_items) as item(product_id uuid, price_yen integer)
    group by item.product_id
    having count(*) > 1
  ) then
    raise exception 'A product may only appear once in a campaign';
  end if;

  select count(*)
  into active_product_count
  from jsonb_to_recordset(p_items) as item(product_id uuid, price_yen integer)
  join public.products product on product.id = item.product_id and product.active;
  if active_product_count <> item_count then
    raise exception 'All campaign products must exist and be active';
  end if;

  select count(*)
  into active_store_count
  from unnest(p_store_ids) as selected(store_id)
  join public.stores store on store.id = selected.store_id and store.status = 'active';
  if active_store_count <> cardinality(p_store_ids) then
    raise exception 'All campaign stores must exist and be active';
  end if;

  select item.product_id, item.price_yen
  into first_product_id, first_price_yen
  from jsonb_array_elements(p_items) with ordinality as raw(value, position)
  cross join lateral jsonb_to_record(raw.value) as item(product_id uuid, price_yen integer)
  order by raw.position
  limit 1;

  insert into public.campaigns (name, product_id, price_yen, starts_at, ends_at, status, created_by)
  values (trim(p_name), first_product_id, first_price_yen, p_starts_at, p_ends_at, 'draft', (select auth.uid()))
  returning id into v_campaign_id;

  insert into public.campaign_items (campaign_id, product_id, price_yen)
  select v_campaign_id, item.product_id, item.price_yen
  from jsonb_to_recordset(p_items) as item(product_id uuid, price_yen integer);

  insert into public.campaign_store_targets (campaign_id, store_id)
  select v_campaign_id, selected.store_id
  from unnest(p_store_ids) as selected(store_id);

  insert into public.campaign_item_store_tasks (campaign_item_id, store_id)
  select item.id, target.store_id
  from public.campaign_items item
  join public.campaign_store_targets target on target.campaign_id = item.campaign_id
  where item.campaign_id = v_campaign_id;

  return v_campaign_id;
end;
$$;

create or replace function public.publish_campaign_draft(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['product_office']::public.app_role[]) then
    raise exception 'Only product office users can publish campaigns';
  end if;
  if exists (
    select 1
    from public.campaign_items item
    where item.campaign_id = p_campaign_id
      and item.eligibility_status <> 'eligible'
  ) then
    raise exception 'Campaign products must be verified as non-EDLP before publication';
  end if;
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

create or replace function public.set_campaign_store_confirmation(
  p_campaign_item_id uuid,
  p_store_id uuid,
  p_confirmed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_confirmed is null then
    raise exception 'Confirmation state is required';
  end if;
  if not exists (
    select 1
    from public.user_role_assignments assignment
    join public.app_users app_user on app_user.id = assignment.user_id and app_user.active
    where assignment.user_id = (select auth.uid())
      and assignment.store_id = p_store_id
      and assignment.role in ('store_manager', 'department_lead', 'staff')
  ) then
    raise exception 'Only an assigned store user can confirm a campaign';
  end if;

  update public.campaign_store_targets target
  set store_confirmed_at = case when p_confirmed then now() else null end,
      store_confirmed_by = case when p_confirmed then (select auth.uid()) else null end,
      updated_at = now()
  where target.campaign_id = (
      select item.campaign_id from public.campaign_items item where item.id = p_campaign_item_id
    )
    and target.store_id = p_store_id
    and exists (
      select 1 from public.campaigns campaign
      where campaign.id = target.campaign_id and campaign.status in ('scheduled', 'active')
        and not exists (
          select 1
          from public.campaign_items campaign_item
          where campaign_item.campaign_id = campaign.id
            and campaign_item.eligibility_status <> 'eligible'
        )
    );

  if not found then
    raise exception 'Campaign item is not available for store confirmation';
  end if;
end;
$$;

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
    'price_label_changed', 'pop_changed', 'display_changed',
    'price_label_restored', 'pop_restored', 'display_restored'
  ) then
    raise exception 'Unknown campaign store task';
  end if;

  update public.campaign_item_store_tasks task
  set price_label_changed_at = case when p_task = 'price_label_changed' then
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

revoke all on function public.create_campaign_draft(text, timestamptz, timestamptz, jsonb, uuid[]) from public;
revoke all on function public.publish_campaign_draft(uuid) from public;
revoke all on function public.set_campaign_store_confirmation(uuid, uuid, boolean) from public;
revoke all on function public.set_campaign_item_store_task(uuid, uuid, text, boolean) from public;
grant execute on function public.create_campaign_draft(text, timestamptz, timestamptz, jsonb, uuid[]) to authenticated;
grant execute on function public.publish_campaign_draft(uuid) to authenticated;
grant execute on function public.set_campaign_store_confirmation(uuid, uuid, boolean) to authenticated;
grant execute on function public.set_campaign_item_store_task(uuid, uuid, text, boolean) to authenticated;
