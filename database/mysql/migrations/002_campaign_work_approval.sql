ALTER TABLE `campaign_item_store_tasks`
  ADD COLUMN `work_approved_at` DATETIME(3),
  ADD COLUMN `work_approved_by` CHAR(36),
  ADD CONSTRAINT `campaign_work_approved_by_user`
    FOREIGN KEY (`work_approved_by`) REFERENCES `app_users` (`id`) ON DELETE SET NULL;
