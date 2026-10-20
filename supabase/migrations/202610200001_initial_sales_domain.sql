create type public.app_role as enum (
  'product_office',
  'store_operations',
  'information_systems',
  'area_manager',
  'store_manager',
  'department_lead',
  'staff',
  'accounting'
);

create type public.store_status as enum ('active', 'temporarily_closed', 'closed');
create type public.sales_day_status as enum ('imported', 'confirmed', 'monthly_finalized');
create type public.correction_status as enum (
  'pending_area_approval',
  'pending_operations_approval',
  'rejected',
  'approved',
  'cancelled'
);
create type public.campaign_status as enum ('draft', 'scheduled', 'active', 'completed', 'failed');
create type public.import_status as enum ('received', 'processing', 'completed', 'failed');

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint area_code_not_blank check (length(trim(code)) > 0)
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id) on delete restrict,
  code text not null unique,
  name text not null,
  timezone text not null default 'Asia/Tokyo',
  business_day_starts_at time not null default '22:30',
  closing_time time not null default '22:30',
  status public.store_status not null default 'active',
  has_dine_in boolean not null default false,
  opened_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_code_not_blank check (length(trim(code)) > 0)
);

create table public.app_users (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_user_name_not_blank check (length(trim(display_name)) > 0)
);

create table public.store_departments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  code text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, code),
  unique (store_id, id)
);

create table public.user_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete restrict,
  role public.app_role not null,
  area_id uuid references public.areas(id) on delete restrict,
  store_id uuid references public.stores(id) on delete restrict,
  department_id uuid,
  assigned_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint role_scope_is_unambiguous check (area_id is null or store_id is null),
  constraint department_role_requires_store check (
    department_id is null or (store_id is not null and area_id is null)
  ),
  constraint role_scope_matches_role check (
    (role = 'area_manager' and area_id is not null and store_id is null and department_id is null)
    or (role = 'store_manager' and store_id is not null and department_id is null)
    or (role in ('department_lead', 'staff') and store_id is not null and department_id is not null)
    or (
      role in ('product_office', 'store_operations', 'information_systems', 'accounting')
      and area_id is null and store_id is null and department_id is null
    )
  ),
  foreign key (store_id, department_id)
    references public.store_departments(store_id, id) on delete restrict,
  unique nulls not distinct (user_id, role, area_id, store_id, department_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category_code text,
  tax_rate numeric(4, 2) not null check (tax_rate in (8, 10)),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_code_not_blank check (length(trim(code)) > 0),
  constraint product_name_length check (char_length(name) between 1 and 200)
);

create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  store_id uuid references public.stores(id) on delete restrict,
  price_yen integer not null check (price_yen >= 0),
  valid_from timestamptz not null,
  valid_until timestamptz,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint product_price_period_valid check (valid_until is null or valid_until > valid_from)
);
create index product_prices_lookup on public.product_prices(product_id, store_id, valid_from desc);

create table public.store_products (
  store_id uuid not null references public.stores(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  shelf_location text,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (store_id, product_id)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  product_id uuid not null references public.products(id) on delete restrict,
  price_yen integer not null check (price_yen >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.campaign_status not null default 'draft',
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_period_valid check (ends_at > starts_at),
  constraint campaign_name_not_blank check (length(trim(name)) > 0)
);

create table public.campaign_store_targets (
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  applied_at timestamptz,
  restored_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, store_id),
  constraint campaign_target_restore_after_apply check (
    restored_at is null or applied_at is not null
  )
);

create table public.sales_imports (
  id uuid primary key default gen_random_uuid(),
  source_file_name text not null,
  source_checksum text not null unique,
  status public.import_status not null default 'received',
  received_at timestamptz not null default now(),
  completed_at timestamptz,
  rows_received integer not null default 0 check (rows_received >= 0),
  error_summary text,
  started_by uuid references public.app_users(id) on delete set null
);

create table public.store_sales_imports (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.sales_imports(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  business_date date not null,
  status public.import_status not null default 'received',
  rows_received integer not null default 0 check (rows_received >= 0),
  completed_at timestamptz,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_id, store_id)
);
create index store_sales_imports_monitoring on public.store_sales_imports(status, business_date, store_id);

create table public.sales_days (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  business_date date not null,
  status public.sales_day_status not null default 'imported',
  gross_sales_yen bigint not null default 0 check (gross_sales_yen >= 0),
  net_sales_yen bigint not null default 0 check (net_sales_yen >= 0),
  transaction_count integer not null default 0 check (transaction_count >= 0),
  customer_count integer not null default 0 check (customer_count >= 0),
  imported_at timestamptz,
  confirmed_by uuid references public.app_users(id) on delete set null,
  confirmed_at timestamptz,
  monthly_finalized_by uuid references public.app_users(id) on delete set null,
  monthly_finalized_at timestamptz,
  import_id uuid references public.sales_imports(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, business_date),
  constraint sales_day_confirmation_consistent check (
    (status = 'imported' and confirmed_at is null and monthly_finalized_at is null)
    or (status = 'confirmed' and confirmed_at is not null and monthly_finalized_at is null)
    or (status = 'monthly_finalized' and confirmed_at is not null and monthly_finalized_at is not null)
  )
);
create index sales_days_date_store on public.sales_days(business_date desc, store_id);

create table public.sales_lines (
  id uuid primary key default gen_random_uuid(),
  sales_day_id uuid not null references public.sales_days(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  product_code_snapshot text not null,
  product_name_snapshot text not null,
  department_id uuid references public.store_departments(id) on delete restrict,
  quantity numeric(12, 3) not null,
  amount_yen bigint not null,
  tax_rate numeric(4, 2) not null check (tax_rate in (8, 10)),
  transaction_time timestamptz not null,
  line_type text not null check (line_type in ('sale', 'discount', 'void', 'return')),
  source_row_key text not null,
  import_id uuid not null references public.sales_imports(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (import_id, source_row_key)
);
create index sales_lines_day on public.sales_lines(sales_day_id, transaction_time);

create table public.sales_corrections (
  id uuid primary key default gen_random_uuid(),
  sales_day_id uuid not null references public.sales_days(id) on delete restrict,
  reason text not null check (char_length(trim(reason)) between 1 and 500),
  before_amount_yen bigint not null,
  after_amount_yen bigint not null check (after_amount_yen >= 0),
  status public.correction_status not null default 'pending_area_approval',
  requested_by uuid not null references public.app_users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sales_corrections_pending on public.sales_corrections(status, requested_at);
create unique index one_pending_correction_per_sales_day
  on public.sales_corrections(sales_day_id)
  where status in ('pending_area_approval', 'pending_operations_approval');

create table public.sales_approvals (
  id uuid primary key default gen_random_uuid(),
  correction_id uuid not null references public.sales_corrections(id) on delete restrict,
  approval_stage text not null check (approval_stage in ('area', 'operations', 'same_day')),
  approved boolean not null,
  comment text check (comment is null or char_length(comment) <= 500),
  actor_id uuid not null references public.app_users(id) on delete restrict,
  acted_at timestamptz not null default now(),
  unique (correction_id, approval_stage)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_recent on public.notifications(user_id, created_at desc);

create table public.batch_runs (
  id uuid primary key default gen_random_uuid(),
  batch_type text not null,
  status public.import_status not null default 'received',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result_summary jsonb not null default '{}'::jsonb,
  error_summary text,
  started_by uuid references public.app_users(id) on delete set null
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  department_id uuid not null,
  order_date date not null,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'sent', 'failed', 'cancelled')),
  requested_by uuid not null references public.app_users(id) on delete restrict,
  requested_delivery_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (store_id, department_id)
    references public.store_departments(store_id, id) on delete restrict
);
create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 99999),
  created_at timestamptz not null default now(),
  unique (order_id, product_id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  before_data jsonb,
  after_data jsonb
);
create index audit_logs_record on public.audit_logs(table_name, record_id, occurred_at desc);
create index audit_logs_recent on public.audit_logs(occurred_at desc);

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
      and app_user.active
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
      on app_user.id = assignment.user_id and app_user.active
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
      on app_user.id = assignment.user_id and app_user.active
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
      on app_user.id = assignment.user_id and app_user.active
    where store.id = p_store_id
      and (p_roles is null or assignment.role = any (p_roles))
  );
$$;

create or replace function public.can_access_sales_line(
  p_sales_day_id uuid,
  p_department_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sales_days day
    where day.id = p_sales_day_id
      and (
        (p_department_id is null and public.can_access_store(day.store_id))
        or (
          p_department_id is not null
          and public.can_access_department(day.store_id, p_department_id)
        )
      )
  );
$$;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_record jsonb;
  new_record jsonb;
  record_key text;
begin
  if tg_op <> 'INSERT' then old_record := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_record := to_jsonb(new); end if;
  record_key := coalesce(
    new_record ->> 'id',
    old_record ->> 'id',
    coalesce(new_record, old_record)::text
  );

  insert into public.audit_logs (
    table_name, record_id, operation, actor_id, before_data, after_data
  ) values (
    tg_table_name, record_key, tg_op, (select auth.uid()), old_record, new_record
  );
  return null;
end;
$$;

create or replace function public.store_business_date(
  p_store_id uuid,
  p_at timestamptz default now()
)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  store_timezone text;
  day_starts_at time;
  local_timestamp timestamp;
begin
  select timezone, business_day_starts_at
  into store_timezone, day_starts_at
  from public.stores
  where id = p_store_id;

  if not found then raise exception 'Store not found'; end if;

  local_timestamp := p_at at time zone store_timezone;
  if local_timestamp::time < day_starts_at then
    return local_timestamp::date - 1;
  end if;
  return local_timestamp::date;
end;
$$;

create or replace function public.request_sales_correction(
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
  sales_day public.sales_days%rowtype;
  correction_id uuid;
  next_status public.correction_status;
  is_same_business_day boolean;
begin
  select * into sales_day
  from public.sales_days
  where id = p_sales_day_id
  for update;

  if not found then raise exception 'Sales day not found'; end if;
  if not public.can_access_store(sales_day.store_id, array['store_manager']::public.app_role[]) then
    raise exception 'You are not allowed to correct this store';
  end if;
  if sales_day.status = 'monthly_finalized' then
    raise exception 'Monthly finalized sales cannot be changed';
  end if;
  if sales_day.status = 'imported' and
     public.store_business_date(sales_day.store_id) <> sales_day.business_date then
    raise exception 'Sales for a prior business date must be confirmed before requesting a correction';
  end if;

  is_same_business_day :=
    public.store_business_date(sales_day.store_id) = sales_day.business_date;
  next_status := case
    when is_same_business_day then 'approved'::public.correction_status
    else 'pending_area_approval'::public.correction_status
  end;

  insert into public.sales_corrections (
    sales_day_id, reason, before_amount_yen, after_amount_yen, status, requested_by
  ) values (
    sales_day.id,
    p_reason,
    sales_day.net_sales_yen,
    p_after_amount_yen,
    next_status,
    (select auth.uid())
  )
  returning id into correction_id;

  if is_same_business_day then
    update public.sales_days
    set net_sales_yen = p_after_amount_yen, updated_at = now()
    where id = sales_day.id;

    insert into public.sales_approvals (
      correction_id, approval_stage, approved, comment, actor_id
    ) values (
      correction_id, 'same_day', true, 'Same-business-day manager correction', (select auth.uid())
    );
  end if;

  return correction_id;
end;
$$;

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

create trigger audit_store_changes after insert or update or delete on public.stores
  for each row execute function public.write_audit_log();
create trigger audit_area_changes after insert or update or delete on public.areas
  for each row execute function public.write_audit_log();
create trigger audit_user_changes after insert or update or delete on public.app_users
  for each row execute function public.write_audit_log();
create trigger audit_department_changes after insert or update or delete on public.store_departments
  for each row execute function public.write_audit_log();
create trigger audit_product_changes after insert or update or delete on public.products
  for each row execute function public.write_audit_log();
create trigger audit_price_changes after insert or update or delete on public.product_prices
  for each row execute function public.write_audit_log();
create trigger audit_campaign_changes after insert or update or delete on public.campaigns
  for each row execute function public.write_audit_log();
create trigger audit_sales_day_changes after insert or update or delete on public.sales_days
  for each row execute function public.write_audit_log();
create trigger audit_correction_changes after insert or update or delete on public.sales_corrections
  for each row execute function public.write_audit_log();
create trigger audit_approval_changes after insert or update or delete on public.sales_approvals
  for each row execute function public.write_audit_log();
create trigger audit_order_changes after insert or update or delete on public.orders
  for each row execute function public.write_audit_log();
create trigger audit_role_changes after insert or update or delete on public.user_role_assignments
  for each row execute function public.write_audit_log();
create trigger audit_campaign_target_changes after insert or update or delete on public.campaign_store_targets
  for each row execute function public.write_audit_log();
create trigger audit_store_import_changes after insert or update or delete on public.store_sales_imports
  for each row execute function public.write_audit_log();

create or replace function public.confirm_sales_day(p_sales_day_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sales_day public.sales_days%rowtype;
begin
  select * into sales_day
  from public.sales_days
  where id = p_sales_day_id
  for update;

  if not found then raise exception 'Sales day not found'; end if;
  if not public.can_access_store(sales_day.store_id, array['store_manager']::public.app_role[]) then
    raise exception 'You are not allowed to confirm this store';
  end if;
  if sales_day.status <> 'imported' then
    raise exception 'Only imported sales days can be confirmed';
  end if;
  if public.store_business_date(sales_day.store_id) <> sales_day.business_date then
    raise exception 'Only sales for the current business date can be confirmed';
  end if;

  update public.sales_days
  set status = 'confirmed', confirmed_by = (select auth.uid()), confirmed_at = now(),
      updated_at = now()
  where id = p_sales_day_id;
end;
$$;

create or replace function public.approve_sales_correction(
  p_correction_id uuid,
  p_approved boolean,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  correction public.sales_corrections%rowtype;
  target_store uuid;
  stage_name text;
  required_role public.app_role;
  next_status public.correction_status;
begin
  if p_comment is not null and char_length(p_comment) > 500 then
    raise exception 'Comment must be 500 characters or fewer';
  end if;

  select * into correction
  from public.sales_corrections
  where id = p_correction_id
  for update;

  if not found then raise exception 'Correction not found'; end if;
  select store_id into target_store
  from public.sales_days where id = correction.sales_day_id;

  if correction.status = 'pending_area_approval' then
    stage_name := 'area';
    required_role := 'area_manager';
    next_status := case when p_approved then 'pending_operations_approval' else 'rejected' end;
  elsif correction.status = 'pending_operations_approval' then
    stage_name := 'operations';
    required_role := 'store_operations';
    next_status := case when p_approved then 'approved' else 'rejected' end;
  else
    raise exception 'Correction is not awaiting approval';
  end if;

  if not public.can_access_store(target_store, array[required_role]::public.app_role[]) then
    raise exception 'You are not allowed to approve this correction';
  end if;

  insert into public.sales_approvals (
    correction_id, approval_stage, approved, comment, actor_id
  ) values (
    correction.id, stage_name, p_approved, p_comment, (select auth.uid())
  );
  update public.sales_corrections
  set status = next_status, updated_at = now()
  where id = correction.id;

  if next_status = 'approved' then
    update public.sales_days
    set net_sales_yen = net_sales_yen
          + (correction.after_amount_yen - correction.before_amount_yen),
        updated_at = now()
    where id = correction.sales_day_id;
  end if;
end;
$$;

alter table public.areas enable row level security;
alter table public.stores enable row level security;
alter table public.app_users enable row level security;
alter table public.store_departments enable row level security;
alter table public.user_role_assignments enable row level security;
alter table public.products enable row level security;
alter table public.product_prices enable row level security;
alter table public.store_products enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_store_targets enable row level security;
alter table public.sales_imports enable row level security;
alter table public.store_sales_imports enable row level security;
alter table public.sales_days enable row level security;
alter table public.sales_lines enable row level security;
alter table public.sales_corrections enable row level security;
alter table public.sales_approvals enable row level security;
alter table public.notifications enable row level security;
alter table public.batch_runs enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.audit_logs enable row level security;

create policy areas_read_authenticated on public.areas for select to authenticated using (
  public.has_role(enum_range(null::public.app_role))
);
create policy areas_manage_information_systems on public.areas for insert to authenticated
  with check (public.has_role(array['information_systems']::public.app_role[]));
create policy areas_update_information_systems on public.areas for update to authenticated
  using (public.has_role(array['information_systems']::public.app_role[]))
  with check (public.has_role(array['information_systems']::public.app_role[]));
create policy stores_read_authorized on public.stores for select to authenticated using (
  public.can_view_store(id)
);
create policy stores_insert_information_systems on public.stores for insert to authenticated
  with check (public.has_role(array['information_systems']::public.app_role[]));
create policy stores_update_information_systems on public.stores for update to authenticated
  using (public.has_role(array['information_systems']::public.app_role[]))
  with check (public.has_role(array['information_systems']::public.app_role[]));
create policy app_users_read_self_or_admin on public.app_users for select to authenticated using (
  id = (select auth.uid())
  or public.has_role(array['information_systems']::public.app_role[])
);
create policy departments_read_scoped on public.store_departments for select to authenticated using (
  public.can_view_store(store_id)
);
create policy departments_manage_information_systems on public.store_departments for insert to authenticated
  with check (public.has_role(array['information_systems']::public.app_role[]));
create policy departments_update_information_systems on public.store_departments for update to authenticated
  using (public.has_role(array['information_systems']::public.app_role[]))
  with check (public.has_role(array['information_systems']::public.app_role[]));
create policy roles_read_self_or_admin on public.user_role_assignments for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role(array['information_systems']::public.app_role[])
  );
create policy roles_manage_information_systems on public.user_role_assignments for all to authenticated
  using (public.has_role(array['information_systems']::public.app_role[]))
  with check (public.has_role(array['information_systems']::public.app_role[]));
create policy products_read_authenticated on public.products for select to authenticated using (true);
create policy products_insert_product_office on public.products for insert to authenticated
  with check (public.has_role(array['product_office']::public.app_role[]));
create policy products_update_product_office on public.products for update to authenticated
  using (public.has_role(array['product_office']::public.app_role[]))
  with check (public.has_role(array['product_office']::public.app_role[]));
create policy prices_read_authenticated on public.product_prices for select to authenticated using (true);
create policy prices_insert_product_office on public.product_prices for insert to authenticated
  with check (public.has_role(array['product_office']::public.app_role[]));
create policy prices_update_product_office on public.product_prices for update to authenticated
  using (public.has_role(array['product_office']::public.app_role[]))
  with check (public.has_role(array['product_office']::public.app_role[]));
create policy store_products_read_scoped on public.store_products for select to authenticated using (
  public.can_access_store(store_id)
);
create policy store_products_manage_scoped on public.store_products for all to authenticated
  using (
    public.can_access_store(store_id, array['information_systems']::public.app_role[])
  )
  with check (
    public.can_access_store(store_id, array['information_systems']::public.app_role[])
  );
create policy campaigns_read_authenticated on public.campaigns for select to authenticated using (true);
create policy campaigns_insert_product_office on public.campaigns for insert to authenticated
  with check (public.has_role(array['product_office']::public.app_role[]));
create policy campaigns_update_product_office on public.campaigns for update to authenticated
  using (public.has_role(array['product_office']::public.app_role[]))
  with check (public.has_role(array['product_office']::public.app_role[]));
create policy campaign_targets_read_scoped on public.campaign_store_targets for select to authenticated
  using (public.can_access_store(store_id));
create policy campaign_targets_manage_product_office on public.campaign_store_targets
  for all to authenticated using (
    public.has_role(array['product_office']::public.app_role[])
  ) with check (
    public.has_role(array['product_office']::public.app_role[])
  );
create policy imports_read_information_systems on public.sales_imports for select to authenticated
  using (public.has_role(array['information_systems', 'store_operations']::public.app_role[]));
create policy store_imports_read_scoped on public.store_sales_imports for select to authenticated
  using (public.can_access_store(store_id));
create policy store_imports_insert_information_systems on public.store_sales_imports for insert to authenticated
  with check (public.has_role(array['information_systems']::public.app_role[]));
create policy sales_days_read_scoped on public.sales_days for select to authenticated using (
  public.can_access_store(store_id)
);
create policy sales_days_insert_import on public.sales_days for insert to authenticated with check (
  public.has_role(array['information_systems']::public.app_role[])
);
create policy sales_lines_read_scoped on public.sales_lines for select to authenticated using (
  public.can_access_sales_line(sales_day_id, department_id)
);
create policy corrections_read_scoped on public.sales_corrections for select to authenticated using (
  exists (
    select 1 from public.sales_days day
    where day.id = sales_day_id and public.can_access_store(day.store_id)
  )
);
create policy approvals_read_scoped on public.sales_approvals for select to authenticated using (
  exists (
    select 1
    from public.sales_corrections correction
    join public.sales_days day on day.id = correction.sales_day_id
    where correction.id = correction_id and public.can_access_store(day.store_id)
  )
);
create policy notifications_read_own on public.notifications for select to authenticated using (
  user_id = (select auth.uid())
);
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy batch_runs_read_information_systems on public.batch_runs for select to authenticated
  using (public.has_role(array['information_systems']::public.app_role[]));
create policy orders_read_scoped on public.orders for select to authenticated using (
  public.can_access_department(store_id, department_id)
);
create policy orders_insert_scoped on public.orders for insert to authenticated with check (
  requested_by = (select auth.uid())
  and public.can_access_department(
    store_id,
    department_id,
    array['department_lead', 'staff', 'store_manager']::public.app_role[]
  )
);
create policy order_lines_read_scoped on public.order_lines for select to authenticated using (
  exists (
    select 1 from public.orders order_header
    where order_header.id = order_id
      and public.can_access_department(order_header.store_id, order_header.department_id)
  )
);
create policy order_lines_insert_scoped on public.order_lines for insert to authenticated with check (
  exists (
    select 1 from public.orders order_header
    where order_header.id = order_id
      and order_header.status = 'draft'
      and order_header.requested_by = (select auth.uid())
      and public.can_access_department(order_header.store_id, order_header.department_id)
  )
);
create policy audit_logs_read_information_systems on public.audit_logs for select to authenticated
  using (public.has_role(array['information_systems']::public.app_role[]));

revoke all on function public.write_audit_log() from public, anon, authenticated;
revoke all on function public.has_role(public.app_role[]) from public, anon;
revoke all on function public.can_access_store(uuid, public.app_role[]) from public, anon;
revoke all on function public.can_view_store(uuid) from public, anon;
revoke all on function public.can_access_department(uuid, uuid, public.app_role[]) from public, anon;
revoke all on function public.can_access_sales_line(uuid, uuid) from public, anon;
revoke all on function public.confirm_sales_day(uuid) from public, anon;
revoke all on function public.approve_sales_correction(uuid, boolean, text) from public, anon;
revoke all on function public.request_sales_correction(uuid, text, bigint) from public, anon;
revoke all on function public.finalize_sales_month(uuid, date) from public, anon;
revoke all on function public.store_business_date(uuid, timestamptz) from public, anon;
revoke insert, update, delete on public.sales_corrections from anon, authenticated;
revoke insert, update, delete on public.sales_approvals from anon, authenticated;
grant execute on function public.has_role(public.app_role[]) to authenticated;
grant execute on function public.can_access_store(uuid, public.app_role[]) to authenticated;
grant execute on function public.can_view_store(uuid) to authenticated;
grant execute on function public.can_access_department(uuid, uuid, public.app_role[]) to authenticated;
grant execute on function public.can_access_sales_line(uuid, uuid) to authenticated;
grant execute on function public.confirm_sales_day(uuid) to authenticated;
grant execute on function public.approve_sales_correction(uuid, boolean, text) to authenticated;
grant execute on function public.request_sales_correction(uuid, text, bigint) to authenticated;
grant execute on function public.finalize_sales_month(uuid, date) to authenticated;
grant execute on function public.store_business_date(uuid, timestamptz) to authenticated;
