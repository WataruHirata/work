-- FR-008/009/029, AT-04/05/10: notify existing two-stage approval, no monetary rule changes.
alter table public.notifications add column correction_id uuid references public.sales_corrections(id);
create unique index correction_notification_once on public.notifications(user_id,correction_id,notification_type) where correction_id is not null;
create function public.notify_sales_correction() returns trigger language plpgsql security definer set search_path='' as $$
declare v_store uuid; v_area uuid; v_name text; v_date date; v_message text; v_type text; v_title text;
begin
  if tg_op='UPDATE' and old.status=new.status then return new; end if;
  select d.store_id,s.area_id,s.name,d.business_date into v_store,v_area,v_name,v_date from public.sales_days d join public.stores s on s.id=d.store_id where d.id=new.sales_day_id;
  v_message:=left(v_name,150)||' / '||v_date||E'\n変更前: '||new.before_amount_yen||'円 → 変更後: '||new.after_amount_yen||E'円\n理由: '||new.reason;
  if new.status in ('pending_area_approval','pending_operations_approval') then
    v_type:=case when new.status='pending_area_approval' then 'correction_requested' else 'correction_operations_requested' end;
    v_title:=case when new.status='pending_area_approval' then '店舗から売上修正依頼（エリア一次承認待ち）' else '売上修正依頼（本部最終承認待ち）' end;
    insert into public.notifications(user_id,notification_type,title,message,correction_id)
      select distinct a.user_id,v_type,v_title,v_message,new.id from public.user_role_assignments a join public.app_users u on u.id=a.user_id and u.active
      where (a.store_id is null or a.store_id=v_store) and (a.area_id is null or a.area_id=v_area)
        and (a.role='store_operations' or (new.status='pending_area_approval' and a.role='area_manager'))
      on conflict do nothing;
    if tg_op='INSERT' then
      insert into public.notifications(user_id,notification_type,title,message,correction_id) values(new.requested_by,'correction_submitted','売上修正依頼を受け付けました',v_message,new.id) on conflict do nothing;
    end if;
  elsif new.status in ('approved','rejected') then
    v_title:=case when new.status='approved' then '売上修正依頼が承認されました' else '売上修正依頼が差し戻されました' end;
    if new.status='rejected' then
      v_message:=v_message||E'\n差戻し理由: '||coalesce((select comment from public.sales_approvals where correction_id=new.id order by acted_at desc limit 1),'承認履歴を確認してください');
    end if;
    insert into public.notifications(user_id,notification_type,title,message,correction_id) values(new.requested_by,'correction_'||new.status::text,v_title,v_message,new.id) on conflict do nothing;
    -- Store-level result omits individual names and is readable on registered shared devices.
    insert into public.store_announcements(store_id,title,message,created_by) values(v_store,v_title,v_message,(select auth.uid()));
  end if;
  return new;
end; $$;
create trigger notify_sales_correction after insert or update of status on public.sales_corrections for each row execute function public.notify_sales_correction();
revoke all on function public.notify_sales_correction() from public,anon,authenticated;
