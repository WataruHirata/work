ALTER TABLE `store_instruction_targets`
  ADD COLUMN `confirmed_device_id` CHAR(36) NULL AFTER `confirmed_by`,
  ADD CONSTRAINT `instruction_target_confirmed_device_fk`
    FOREIGN KEY (`confirmed_device_id`) REFERENCES `store_devices` (`id`) ON DELETE RESTRICT;

ALTER TABLE `store_instruction_targets`
  ADD CONSTRAINT `instruction_confirmation_actor_valid`
    CHECK (
      `confirmed_at` IS NULL
      OR (`confirmed_by` IS NOT NULL) <> (`confirmed_device_id` IS NOT NULL)
    );
