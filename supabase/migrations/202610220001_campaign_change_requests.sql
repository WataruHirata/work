-- FR-020/028/029, AT-07/10: publication sends product/price/period requests
-- through existing store instructions and announcements; no POS delivery is implied.
create or replace function public.notify_campaign_publication()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_item record;
  v_instruction_id uuid;
  v_title text;
  v_message text;
begin
  if old.published_at is null and new.published_at is not null then
    for v_item in
      select item.product_id,item.price_yen,product.code,product.name
      from public.campaign_items item join public.products product on product.id=item.product_id
      where item.campaign_id=new.id order by item.id
    loop
      v_title=left('POS・値札変更依頼：'||new.name||' / '||v_item.name,200);
      v_message='特売「'||left(new.name,200)||'」のPOS価格設定と値札の変更をお願いします。'
        ||E'\n商品：'||left(v_item.code,100)||' / '||left(v_item.name,200)
        ||E'\n特売価格：'||v_item.price_yen||'円'
        ||E'\n開始：'||to_char(new.starts_at at time zone 'Asia/Tokyo','YYYY/MM/DD HH24:MI')||'（日本時間）'
        ||E'\n終了：'||to_char(new.ends_at at time zone 'Asia/Tokyo','YYYY/MM/DD HH24:MI')||'（日本時間）'
        ||E'\n開始に合わせてPOSの特売価格設定・値札・POP・売場表示を確認してください。終了時は通常売価を確認してPOS設定と値札を戻してください。'
        ||E'\nこの通知は変更依頼です。POSに反映済みであることを示しません。';
      insert into public.store_instructions(request_id,kind,title,message,product_id,price_yen,effective_at,created_by)
        values(gen_random_uuid(),'promotion',v_title,v_message,v_item.product_id,v_item.price_yen,new.starts_at,(select auth.uid()))
        returning id into v_instruction_id;
      insert into public.store_instruction_targets(instruction_id,store_id)
        select v_instruction_id,store_id from public.campaign_store_targets where campaign_id=new.id;
      insert into public.store_announcements(store_id,title,message,created_by)
        select store_id,v_title,v_message,(select auth.uid()) from public.campaign_store_targets where campaign_id=new.id;
    end loop;
  end if;
  return new;
end; $$;
revoke all on function public.notify_campaign_publication() from public,anon,authenticated;
