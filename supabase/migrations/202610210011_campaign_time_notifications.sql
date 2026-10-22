create table public.campaign_alert_events (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  event_type text not null check (event_type in ('pre_start', 'started', 'ended')),
  created_at timestamptz not null default now(),
  primary key (campaign_id, event_type)
);

create or replace function public.emit_campaign_timing_alert(
  p_campaign_id uuid,
  p_event_type text,
  p_title text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_campaign_id is null or p_event_type is null or p_title is null or p_message is null then
    raise exception 'Campaign timing alert details are required';
  end if;
  if p_event_type not in ('pre_start', 'started', 'ended') then
    raise exception 'Unsupported campaign timing event';
  end if;

  insert into public.campaign_alert_events(campaign_id, event_type)
  values (p_campaign_id, p_event_type)
  on conflict (campaign_id, event_type) do nothing;
  if not found then
    return;
  end if;

  insert into public.store_announcements(store_id, title, message, created_by)
  select target.store_id, p_title, p_message, (select auth.uid())
  from public.campaign_store_targets target
  where target.campaign_id = p_campaign_id;

  insert into public.notifications(user_id, notification_type, title, message)
  select distinct assignment.user_id, 'campaign_' || p_event_type, p_title, p_message
  from public.user_role_assignments assignment
  where assignment.role in ('product_office', 'store_manager', 'department_lead', 'staff')
    and (
      assignment.role = 'product_office'
      or assignment.store_id in (
        select store_id from public.campaign_store_targets where campaign_id = p_campaign_id
      )
    );
end;
$$;

create or replace function public.refresh_campaign_timing_alerts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign record;
begin
  for v_campaign in
    select c.id, c.name, c.starts_at
    from public.campaigns c
    where c.status = 'scheduled'
      and c.published_at is not null
      and now() >= c.starts_at - interval '30 minutes'
      and now() < c.starts_at
  loop
    perform public.emit_campaign_timing_alert(
      v_campaign.id,
      'pre_start',
      '特売開始予定: ' || left(v_campaign.name, 180),
      '開始予定時刻まで30分を切りました。対象店舗では値札・POP・売場表示の確認と完了登録をお願いします。'
    );
  end loop;

  for v_campaign in
    select c.id, c.name, c.starts_at, c.ends_at
    from public.campaigns c
    where c.status = 'scheduled'
      and c.published_at is not null
      and now() >= c.starts_at
      and now() < c.ends_at
  loop
    update public.campaigns
    set status = 'active', updated_at = now()
    where id = v_campaign.id and status = 'scheduled';

    perform public.emit_campaign_timing_alert(
      v_campaign.id,
      'started',
      '特売開始: ' || left(v_campaign.name, 180),
      '特売が開始されました。店舗では作業状況を確認し、未完了の項目を登録してください。'
    );
  end loop;

  for v_campaign in
    select c.id, c.name, c.ends_at
    from public.campaigns c
    where c.status in ('scheduled', 'active')
      and now() >= c.ends_at
  loop
    update public.campaigns
    set status = 'completed', updated_at = now()
    where id = v_campaign.id and status in ('scheduled', 'active');

    perform public.emit_campaign_timing_alert(
      v_campaign.id,
      'ended',
      '特売終了: ' || left(v_campaign.name, 180),
      '特売期間が終了しました。通常価格復帰と最終確認を行ってください。'
    );
  end loop;
end;
$$;

revoke all on function public.emit_campaign_timing_alert(uuid, text, text, text), public.refresh_campaign_timing_alerts() from public, anon, authenticated;
grant execute on function public.emit_campaign_timing_alert(uuid, text, text, text), public.refresh_campaign_timing_alerts() to authenticated;
