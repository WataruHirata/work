-- FR-020/028/029, F-10-030/031/035, AT-07/10: HQ instructions, distinct from POS prices.
create table public.store_instructions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  kind text not null check(kind in ('promotion','price_change')),
  title text not null check(length(trim(title)) between 1 and 200),
  message text not null check(length(trim(message)) between 1 and 2000),
  product_id uuid not null references public.products(id),
  price_yen integer not null check(price_yen >= 0),
  effective_at timestamptz not null,
  created_by uuid not null references public.app_users(id),
  created_at timestamptz not null default now()
);
create table public.store_instruction_targets (
  instruction_id uuid not null references public.store_instructions(id),
  store_id uuid not null references public.stores(id),
  confirmed_by uuid references public.app_users(id),
  confirmed_at timestamptz,
  primary key(instruction_id,store_id)
);
alter table public.store_instructions enable row level security;
alter table public.store_instruction_targets enable row level security;
create policy instruction_targets_read on public.store_instruction_targets for select to authenticated
  using(public.has_role(array['product_office']::public.app_role[]) or public.can_access_store(store_id,array['store_manager','department_lead','staff']::public.app_role[]));
create policy instructions_read on public.store_instructions for select to authenticated
  using(public.has_role(array['product_office']::public.app_role[]) or exists(select 1 from public.store_instruction_targets t where t.instruction_id=id));
grant select on public.store_instructions,public.store_instruction_targets to authenticated;
revoke all on public.store_instructions,public.store_instruction_targets from anon;
revoke insert,update,delete on public.store_instructions,public.store_instruction_targets from authenticated;
create trigger audit_store_instructions after insert or update or delete on public.store_instructions for each row execute function public.write_audit_log();
create trigger audit_store_instruction_targets after insert or update or delete on public.store_instruction_targets for each row execute function public.write_audit_log();

create function public.send_store_instruction(p_request_id uuid,p_kind text,p_title text,p_message text,p_product_id uuid,p_price_yen integer,p_effective_at timestamptz,p_store_ids uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_existing public.store_instructions%rowtype;
begin
  if not public.has_role(array['product_office']::public.app_role[]) then raise insufficient_privilege; end if;
  if p_request_id is null or p_kind is null or p_kind not in ('promotion','price_change') or p_title is null or length(trim(p_title)) not between 1 and 200 or p_message is null or length(trim(p_message)) not between 1 and 2000 or p_price_yen is null or p_price_yen<0 or p_effective_at is null then raise exception 'Invalid instruction'; end if;
  if p_store_ids is null or cardinality(p_store_ids) not between 1 and 112 or (select count(distinct s) from unnest(p_store_ids) s)<>cardinality(p_store_ids) then raise exception 'Unique target stores required'; end if;
  if (select count(*) from public.stores where id=any(p_store_ids) and status='active')<>cardinality(p_store_ids) then raise exception 'Active target stores required'; end if;
  if not exists(select 1 from public.products where id=p_product_id and active) then raise exception 'Active product required'; end if;
  if p_kind='promotion' and not exists(select 1 from public.products where id=p_product_id and promotion_eligibility='eligible') then raise exception 'Verified promotion product required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_existing from public.store_instructions where request_id=p_request_id;
  if found then
    if v_existing.created_by<>(select auth.uid()) or v_existing.kind<>p_kind or v_existing.title<>trim(p_title) or v_existing.message<>trim(p_message) or v_existing.product_id<>p_product_id or v_existing.price_yen<>p_price_yen or v_existing.effective_at<>p_effective_at or (select array_agg(store_id order by store_id) from public.store_instruction_targets where instruction_id=v_existing.id)<>(select array_agg(s order by s) from unnest(p_store_ids) s) then raise exception 'Request ID conflict'; end if;
    return v_existing.id;
  end if;
  insert into public.store_instructions(request_id,kind,title,message,product_id,price_yen,effective_at,created_by) values(p_request_id,p_kind,trim(p_title),trim(p_message),p_product_id,p_price_yen,p_effective_at,(select auth.uid())) returning id into v_id;
  insert into public.store_instruction_targets(instruction_id,store_id) select v_id,s from unnest(p_store_ids) s;
  insert into public.store_announcements(store_id,title,message,created_by)
    select s,trim(p_title),left(trim(p_message),1400)||E'\n商品: '||(select left(code||' / '||name,150) from public.products where id=p_product_id)||E'\n指示価格: '||p_price_yen||'円 / 実施日時（日本時間）: '||to_char(p_effective_at at time zone 'Asia/Tokyo','YYYY-MM-DD HH24:MI')||E'\n特売・価格画面で指示の全文を確認してください。',(select auth.uid()) from unnest(p_store_ids) s;
  return v_id;
end; $$;
create function public.confirm_store_instruction(p_instruction_id uuid,p_store_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.can_access_store(p_store_id,array['store_manager','department_lead','staff']::public.app_role[]) then raise insufficient_privilege; end if;
  update public.store_instruction_targets set confirmed_at=now(),confirmed_by=(select auth.uid()) where instruction_id=p_instruction_id and store_id=p_store_id and confirmed_at is null;
  if not found and not exists(select 1 from public.store_instruction_targets where instruction_id=p_instruction_id and store_id=p_store_id) then raise exception 'Instruction target missing'; end if;
end; $$;
-- Publishing existing campaigns also produces one notification per target store atomically.
create function public.notify_campaign_publication() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.published_at is null and new.published_at is not null then
    insert into public.store_announcements(store_id,title,message,created_by)
      select store_id,'特売指示: '||left(new.name,190),'本部から特売が公開されました。特売・価格画面で商品・価格・期間と売場作業を確認してください。',(select auth.uid()) from public.campaign_store_targets where campaign_id=new.id;
  end if;
  return new;
end; $$;
create trigger notify_campaign_publication after update on public.campaigns for each row execute function public.notify_campaign_publication();
revoke all on function public.send_store_instruction(uuid,text,text,text,uuid,integer,timestamptz,uuid[]),public.confirm_store_instruction(uuid,uuid),public.notify_campaign_publication() from public,anon,authenticated;
grant execute on function public.send_store_instruction(uuid,text,text,text,uuid,integer,timestamptz,uuid[]),public.confirm_store_instruction(uuid,uuid) to authenticated;
