-- Email is an Auth-owned attribute; the application reads a synchronized directory copy.
alter table public.app_users add column email text;
do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='email') then
    execute 'update public.app_users profile set email=identity.email from auth.users identity where identity.id=profile.id';
  end if;
end; $$;
create or replace function public.create_app_profile(p_user_id uuid,p_employee_code text,p_display_name text)
returns void language plpgsql security definer set search_path='' as $$
declare v_email text;
begin
  if not public.has_role(array['information_systems']::public.app_role[]) then raise insufficient_privilege; end if;
  if length(trim(p_employee_code)) not between 1 and 80 or length(trim(p_display_name)) not between 1 and 200 then raise exception 'Invalid profile'; end if;
  if exists(select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='email') then execute 'select email from auth.users where id=$1' into v_email using p_user_id; end if;
  insert into public.app_users(id,employee_code,display_name,email,must_change_password) values(p_user_id,p_employee_code,p_display_name,v_email,true);
end; $$;
create or replace function public.identity_email_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.app_users set email=new.email,updated_at=clock_timestamp() where id=new.id;
  return new;
end; $$;
do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='email') then
    execute 'create trigger app_identity_email_changed after update of email on auth.users for each row execute function public.identity_email_changed()';
  end if;
end; $$;
revoke all on function public.identity_email_changed() from public,anon,authenticated;
