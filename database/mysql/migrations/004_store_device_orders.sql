ALTER TABLE `orders`
  MODIFY COLUMN `requested_by` CHAR(36) NULL,
  ADD COLUMN `requested_device_id` CHAR(36) NULL AFTER `requested_by`;

ALTER TABLE `orders`
  ADD CONSTRAINT `orders_requested_device_fk`
    FOREIGN KEY (`requested_device_id`) REFERENCES `store_devices` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `orders_request_source_valid`
    CHECK ((`requested_by` IS NULL) <> (`requested_device_id` IS NULL));

CREATE INDEX `orders_requested_device`
  ON `orders` (`requested_device_id`, `created_at`);
