-- FR-028/034/036/038, AT-10: disabled users and initial password changes fail closed.
create or replace function public.has_role(p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_role_assignments assignment
    join public.app_users app_user on app_user.id = assignment.user_id
    where assignment.user_id = (select auth.uid())
      and app_user.active and not app_user.must_change_password
      and assignment.role = any (p_roles)
  );
$$;

create or replace function public.can_access_store(
  p_store_id uuid,
  p_roles public.app_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stores store
    join public.user_role_assignments assignment
      on assignment.user_id = (select auth.uid())
     and (assignment.store_id is null or assignment.store_id = store.id)
     and (assignment.area_id is null or assignment.area_id = store.area_id)
    join public.app_users app_user
      on app_user.id = assignment.user_id and app_user.active and not app_user.must_change_password
    where store.id = p_store_id
      and (p_roles is null or assignment.role = any (p_roles))
      and assignment.department_id is null
  );
$$;

create or replace function public.can_view_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stores store
    join public.user_role_assignments assignment
      on assignment.user_id = (select auth.uid())
     and (assignment.store_id is null or assignment.store_id = store.id)
     and (assignment.area_id is null or assignment.area_id = store.area_id)
    join public.app_users app_user
      on app_user.id = assignment.user_id and app_user.active and not app_user.must_change_password
    where store.id = p_store_id
  );
$$;

create or replace function public.can_access_department(
  p_store_id uuid,
  p_department_id uuid,
  p_roles public.app_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stores store
    join public.store_departments department
      on department.store_id = store.id and department.id = p_department_id
    join public.user_role_assignments assignment
      on assignment.user_id = (select auth.uid())
     and (assignment.store_id is null or assignment.store_id = store.id)
     and (assignment.area_id is null or assignment.area_id = store.area_id)
     and (assignment.department_id is null or assignment.department_id = department.id)
    join public.app_users app_user
      on app_user.id = assignment.user_id and app_user.active and not app_user.must_change_password
    where store.id = p_store_id
      and (p_roles is null or assignment.role = any (p_roles))
  );
$$;

drop policy products_read_authenticated on public.products;
create policy products_read_authenticated on public.products for select to authenticated using(public.has_role(enum_range(null::public.app_role)));
drop policy prices_read_authenticated on public.product_prices;
create policy prices_read_authenticated on public.product_prices for select to authenticated using(public.has_role(enum_range(null::public.app_role)));

-- Monthly finalization serializes with corrections and rejects outstanding approvals.
create or replace function public.finalize_sales_month(
  p_store_id uuid,
  p_month_start date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  finalized_count integer;
  month_end date;
begin
  if p_month_start <> date_trunc('month', p_month_start)::date then
    raise exception 'p_month_start must be the first calendar day of the month';
  end if;
  if not public.can_access_store(p_store_id, array['accounting']::public.app_role[]) then
    raise exception 'You are not allowed to finalize this store';
  end if;

  month_end := (p_month_start + interval '1 month')::date;
  if p_month_start >= date_trunc('month', now() at time zone 'Asia/Tokyo')::date then raise exception 'Only completed months can be finalized'; end if;
  perform 1 from public.sales_days where store_id=p_store_id and business_date>=p_month_start and business_date<month_end order by id for update;
  if exists(select 1 from public.sales_corrections correction join public.sales_days day on day.id=correction.sales_day_id where day.store_id=p_store_id and day.business_date>=p_month_start and day.business_date<month_end and correction.status in ('pending_area_approval','pending_operations_approval')) then raise exception 'Pending corrections must be resolved'; end if;
  if exists (
    select 1 from public.sales_days
    where store_id = p_store_id
      and business_date >= p_month_start
      and business_date < month_end
      and status = 'imported'
  ) then
    raise exception 'All sales days in the month must be confirmed before finalization';
  end if;

  update public.sales_days
  set status = 'monthly_finalized',
      monthly_finalized_by = (select auth.uid()),
      monthly_finalized_at = now(),
      updated_at = now()
  where store_id = p_store_id
    and business_date >= p_month_start
    and business_date < month_end
    and status = 'confirmed';

  get diagnostics finalized_count = row_count;
  if finalized_count = 0 then raise exception 'No confirmed sales days are available to finalize'; end if;
  return finalized_count;
end;
$$;
