-- Fictional records for local development only; no real store or sales data.
insert into public.areas (id, code, name)
values
  ('10000000-0000-4000-8000-000000000001', 'DEMO-A', 'デモエリア A'),
  ('10000000-0000-4000-8000-000000000002', 'DEMO-B', 'デモエリア B')
on conflict (code) do nothing;

insert into public.stores (
  id, area_id, code, name, timezone, business_day_starts_at, closing_time, status, has_dine_in
)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'DEMO-001', 'デモ店舗・標準', 'Asia/Tokyo', '22:30', '22:30', 'active', false),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   'DEMO-002', 'デモ店舗・24時間', 'Asia/Tokyo', '06:00', '06:00', 'active', true),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002',
   'DEMO-003', 'デモ店舗・モール', 'Asia/Tokyo', '21:00', '21:00', 'active', false)
on conflict (code) do nothing;

insert into public.store_departments (store_id, code, name)
values
  ('20000000-0000-4000-8000-000000000001', 'DEMO-BAKERY', 'デモ売場・青果'),
  ('20000000-0000-4000-8000-000000000001', 'DEMO-DELI', 'デモ売場・惣菜'),
  ('20000000-0000-4000-8000-000000000002', 'DEMO-GROCERY', 'デモ売場・食品')
on conflict (store_id, code) do nothing;
