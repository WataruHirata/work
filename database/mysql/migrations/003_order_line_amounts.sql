ALTER TABLE orders
  ADD COLUMN order_total_yen BIGINT NOT NULL DEFAULT 0 AFTER requested_delivery_date;

ALTER TABLE order_lines
  ADD COLUMN unit_price_yen INT NOT NULL DEFAULT 0 AFTER quantity,
  ADD COLUMN line_total_yen BIGINT NOT NULL DEFAULT 0 AFTER unit_price_yen;
