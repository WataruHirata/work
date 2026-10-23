alter table public.orders
  add column if not exists order_total_yen bigint not null default 0 check (order_total_yen >= 0);

alter table public.order_lines
  add column if not exists unit_price_yen integer not null default 0 check (unit_price_yen >= 0),
  add column if not exists line_total_yen bigint not null default 0 check (line_total_yen >= 0);
