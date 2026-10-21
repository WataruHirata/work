-- FR-028/029/037: audit device management without copying bearer tokens or digests.
create function public.audit_store_device() returns trigger language plpgsql security definer set search_path='' as $$
declare v_before jsonb; v_after jsonb;
begin
  if tg_op<>'INSERT' then v_before:=to_jsonb(old)-'token_hash'; end if;
  if tg_op<>'DELETE' then v_after:=to_jsonb(new)-'token_hash'; end if;
  insert into public.audit_logs(table_name,record_id,operation,actor_id,before_data,after_data)
    values('store_devices',coalesce(v_after->>'id',v_before->>'id'),tg_op,(select auth.uid()),v_before,v_after);
  return null;
end; $$;
create trigger audit_device_management after insert or update or delete on public.store_devices for each row execute function public.audit_store_device();
revoke all on function public.audit_store_device() from public,anon,authenticated;
