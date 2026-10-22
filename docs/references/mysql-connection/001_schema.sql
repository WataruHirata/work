SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `areas` (
  `id` CHAR(36) PRIMARY KEY,
  `code` VARCHAR(191) NOT NULL UNIQUE,
  `name` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `area_code_not_blank`
    CHECK (LENGTH(TRIM(`code`)) > 0)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `stores` (
  `id` CHAR(36) PRIMARY KEY,
  `area_id` CHAR(36) NOT NULL,
  `code` VARCHAR(191) NOT NULL UNIQUE,
  `name` TEXT NOT NULL,
  `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Tokyo',
  `business_day_starts_at` TIME NOT NULL DEFAULT '22:30:00',
  `opening_time` TIME NOT NULL DEFAULT '09:00:00',
  `closing_time` TIME NOT NULL DEFAULT '22:30:00',
  `status` VARCHAR(40) NOT NULL DEFAULT 'active',
  `has_dine_in` TINYINT(1) NOT NULL DEFAULT 0,
  `opened_on` DATE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `store_code_not_blank`
    CHECK (LENGTH(TRIM(`code`)) > 0),
  CONSTRAINT `fk_stores_area`
    FOREIGN KEY (`area_id`)
    REFERENCES `areas` (`id`)
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `app_users` (
  `id` CHAR(36) PRIMARY KEY,
  `display_name` TEXT NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `email` VARCHAR(254) UNIQUE,
  `employee_code` VARCHAR(100) UNIQUE,
  `affiliation` VARCHAR(191),
  `must_change_password` TINYINT(1) NOT NULL DEFAULT 0,
  `password_hash` VARCHAR(128) NOT NULL DEFAULT '',
  CONSTRAINT `app_user_name_not_blank`
    CHECK (LENGTH(TRIM(`display_name`)) > 0)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `store_departments` (
  `id` CHAR(36) PRIMARY KEY,
  `store_id` CHAR(36) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` TEXT NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `uq_store_departments_store_code`
    UNIQUE (`store_id`, `code`),
  CONSTRAINT `uq_store_departments_store_id`
    UNIQUE (`store_id`, `id`),
  CONSTRAINT `fk_store_departments_store`
    FOREIGN KEY (`store_id`)
    REFERENCES `stores` (`id`)
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `user_role_assignments` (
  `id` CHAR(36) PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `role` VARCHAR(40) NOT NULL,
  `area_id` CHAR(36),
  `store_id` CHAR(36),
  `department_id` CHAR(36),
  `assigned_by` CHAR(36),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  `area_scope_key` CHAR(36)
    GENERATED ALWAYS AS (
      IFNULL(`area_id`, '00000000-0000-0000-0000-000000000000')
    ) STORED,

  `store_scope_key` CHAR(36)
    GENERATED ALWAYS AS (
      IFNULL(`store_id`, '00000000-0000-0000-0000-000000000000')
    ) STORED,

  `department_scope_key` CHAR(36)
    GENERATED ALWAYS AS (
      IFNULL(`department_id`, '00000000-0000-0000-0000-000000000000')
    ) STORED,

  CONSTRAINT `role_scope_is_unambiguous`
    CHECK (`area_id` IS NULL OR `store_id` IS NULL),

  CONSTRAINT `department_role_requires_store`
    CHECK (
      `department_id` IS NULL
      OR (`store_id` IS NOT NULL AND `area_id` IS NULL)
    ),

  CONSTRAINT `role_scope_matches_role`
    CHECK (
      (
        `role` = 'area_manager'
        AND `area_id` IS NOT NULL
        AND `store_id` IS NULL
        AND `department_id` IS NULL
      )
      OR (
        `role` = 'store_manager'
        AND `area_id` IS NULL
        AND `store_id` IS NOT NULL
        AND `department_id` IS NULL
      )
      OR (
        `role` IN ('department_lead', 'staff')
        AND `area_id` IS NULL
        AND `store_id` IS NOT NULL
        AND `department_id` IS NOT NULL
      )
      OR (
        `role` IN (
          'product_office',
          'store_operations',
          'information_systems',
          'accounting'
        )
        AND `area_id` IS NULL
        AND `store_id` IS NULL
        AND `department_id` IS NULL
      )
    ),

  CONSTRAINT `uq_user_role_assignments_scope`
    UNIQUE (
      `user_id`,
      `role`,
      `area_scope_key`,
      `store_scope_key`,
      `department_scope_key`
    ),

  CONSTRAINT `fk_user_role_assignments_user`
    FOREIGN KEY (`user_id`)
    REFERENCES `app_users` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_user_role_assignments_area`
    FOREIGN KEY (`area_id`)
    REFERENCES `areas` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_user_role_assignments_store`
    FOREIGN KEY (`store_id`)
    REFERENCES `stores` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_user_role_assignments_department`
    FOREIGN KEY (`store_id`, `department_id`)
    REFERENCES `store_departments` (`store_id`, `id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_user_role_assignments_assigned_by`
    FOREIGN KEY (`assigned_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `products` (
  `id` CHAR(36) PRIMARY KEY,
  `code` VARCHAR(191) NOT NULL UNIQUE,
  `name` TEXT NOT NULL,
  `category_code` VARCHAR(191),
  `tax_rate` DECIMAL(4,2) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `promotion_eligibility` VARCHAR(32) NOT NULL DEFAULT 'not_configured',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT `product_tax_rate_valid`
    CHECK (`tax_rate` IN (8.00, 10.00)),

  CONSTRAINT `product_code_not_blank`
    CHECK (LENGTH(TRIM(`code`)) > 0),

  CONSTRAINT `product_name_length`
    CHECK (CHAR_LENGTH(`name`) BETWEEN 1 AND 200),

  CONSTRAINT `product_promotion_eligibility_valid`
    CHECK (
      `promotion_eligibility`
      IN ('not_configured', 'eligible', 'excluded')
    )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `product_prices` (
  `id` CHAR(36) PRIMARY KEY,
  `product_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36),
  `price_yen` INT NOT NULL,
  `valid_from` DATETIME(3) NOT NULL,
  `valid_until` DATETIME(3),
  `created_by` CHAR(36),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT `product_price_nonnegative`
    CHECK (`price_yen` >= 0),

  CONSTRAINT `product_price_period_valid`
    CHECK (
      `valid_until` IS NULL
      OR `valid_until` > `valid_from`
    ),

  CONSTRAINT `fk_product_prices_product`
    FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_product_prices_store`
    FOREIGN KEY (`store_id`)
    REFERENCES `stores` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_product_prices_created_by`
    FOREIGN KEY (`created_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL,

  INDEX `product_prices_lookup`
    (`product_id`, `store_id`, `valid_from`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `store_products` (
  `store_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `shelf_location` TEXT,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`store_id`, `product_id`),

  CONSTRAINT `fk_store_products_store`
    FOREIGN KEY (`store_id`)
    REFERENCES `stores` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_store_products_product`
    FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`)
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `campaigns` (
  `id` CHAR(36) PRIMARY KEY,
  `name` TEXT NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `price_yen` INT NOT NULL,
  `starts_at` DATETIME(3) NOT NULL,
  `ends_at` DATETIME(3) NOT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'draft',
  `created_by` CHAR(36),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `published_at` DATETIME(3),

  CONSTRAINT `campaign_price_nonnegative`
    CHECK (`price_yen` >= 0),

  CONSTRAINT `campaign_period_valid`
    CHECK (`ends_at` > `starts_at`),

  CONSTRAINT `campaign_name_not_blank`
    CHECK (LENGTH(TRIM(`name`)) > 0),

  CONSTRAINT `campaign_status_valid`
    CHECK (`status` IN ('draft', 'published', 'completed', 'cancelled')),

  CONSTRAINT `fk_campaigns_product`
    FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_campaigns_created_by`
    FOREIGN KEY (`created_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `campaign_store_targets` (
  `campaign_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NOT NULL,
  `applied_at` DATETIME(3),
  `restored_at` DATETIME(3),
  `last_error` TEXT,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `store_confirmed_at` DATETIME(3),
  `store_confirmed_by` CHAR(36),

  PRIMARY KEY (`campaign_id`, `store_id`),

  CONSTRAINT `campaign_target_restore_after_apply`
    CHECK (`restored_at` IS NULL OR `applied_at` IS NOT NULL),

  CONSTRAINT `fk_campaign_store_targets_confirmed_by`
    FOREIGN KEY (`store_confirmed_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL,

  CONSTRAINT `fk_campaign_store_targets_campaign`
    FOREIGN KEY (`campaign_id`)
    REFERENCES `campaigns` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_campaign_store_targets_store`
    FOREIGN KEY (`store_id`)
    REFERENCES `stores` (`id`)
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sales_imports` (
  `id` CHAR(36) PRIMARY KEY,
  `source_file_name` TEXT NOT NULL,
  `source_checksum` VARCHAR(191) NOT NULL UNIQUE,
  `status` VARCHAR(40) NOT NULL DEFAULT 'received',
  `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at` DATETIME(3),
  `rows_received` INT NOT NULL DEFAULT 0,
  `error_summary` TEXT,
  `started_by` CHAR(36),

  CONSTRAINT `sales_imports_rows_nonnegative`
    CHECK (`rows_received` >= 0),

  CONSTRAINT `fk_sales_imports_started_by`
    FOREIGN KEY (`started_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `store_sales_imports` (
  `id` CHAR(36) PRIMARY KEY,
  `import_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NOT NULL,
  `business_date` DATE NOT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'received',
  `rows_received` INT NOT NULL DEFAULT 0,
  `completed_at` DATETIME(3),
  `error_summary` TEXT,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT `store_sales_imports_rows_nonnegative`
    CHECK (`rows_received` >= 0),

  CONSTRAINT `uq_store_sales_imports`
    UNIQUE (`import_id`, `store_id`, `business_date`),

  CONSTRAINT `fk_store_sales_imports_import`
    FOREIGN KEY (`import_id`)
    REFERENCES `sales_imports` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_store_sales_imports_store`
    FOREIGN KEY (`store_id`)
    REFERENCES `stores` (`id`)
    ON DELETE RESTRICT,

  INDEX `store_sales_imports_monitoring`
    (`status`, `business_date`, `store_id`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sales_days` (
  `id` CHAR(36) PRIMARY KEY,
  `store_id` CHAR(36) NOT NULL,
  `business_date` DATE NOT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'imported',
  `gross_sales_yen` BIGINT NOT NULL DEFAULT 0,
  `net_sales_yen` BIGINT NOT NULL DEFAULT 0,
  `transaction_count` INT NOT NULL DEFAULT 0,
  `customer_count` INT NOT NULL DEFAULT 0,
  `imported_at` DATETIME(3),
  `confirmed_by` CHAR(36),
  `confirmed_at` DATETIME(3),
  `monthly_finalized_by` CHAR(36),
  `monthly_finalized_at` DATETIME(3),
  `import_id` CHAR(36),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT `sales_days_gross_nonnegative`
    CHECK (`gross_sales_yen` >= 0),

  CONSTRAINT `sales_days_net_nonnegative`
    CHECK (`net_sales_yen` >= 0),

  CONSTRAINT `sales_days_transactions_nonnegative`
    CHECK (`transaction_count` >= 0),

  CONSTRAINT `sales_days_customers_nonnegative`
    CHECK (`customer_count` >= 0),

  CONSTRAINT `uq_sales_days_store_date`
    UNIQUE (`store_id`, `business_date`),

  CONSTRAINT `sales_day_confirmation_consistent`
    CHECK (
      (
        `status` = 'imported'
        AND `confirmed_at` IS NULL
        AND `monthly_finalized_at` IS NULL
      )
      OR (
        `status` = 'confirmed'
        AND `confirmed_at` IS NOT NULL
        AND `monthly_finalized_at` IS NULL
      )
      OR (
        `status` = 'monthly_finalized'
        AND `confirmed_at` IS NOT NULL
        AND `monthly_finalized_at` IS NOT NULL
      )
    ),

  CONSTRAINT `fk_sales_days_store`
    FOREIGN KEY (`store_id`)
    REFERENCES `stores` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_sales_days_confirmed_by`
    FOREIGN KEY (`confirmed_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL,

  CONSTRAINT `fk_sales_days_finalized_by`
    FOREIGN KEY (`monthly_finalized_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL,

  CONSTRAINT `fk_sales_days_import`
    FOREIGN KEY (`import_id`)
    REFERENCES `sales_imports` (`id`)
    ON DELETE RESTRICT,

  INDEX `sales_days_date_store`
    (`business_date`, `store_id`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sales_lines` (
  `id` CHAR(36) PRIMARY KEY,
  `sales_day_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36),
  `product_code_snapshot` VARCHAR(191) NOT NULL,
  `product_name_snapshot` TEXT NOT NULL,
  `department_id` CHAR(36),
  `quantity` DECIMAL(12,3) NOT NULL,
  `amount_yen` BIGINT NOT NULL,
  `tax_rate` DECIMAL(4,2) NOT NULL,
  `transaction_time` DATETIME(3) NOT NULL,
  `line_type` VARCHAR(40) NOT NULL,
  `source_row_key` VARCHAR(191) NOT NULL,
  `import_id` CHAR(36) NOT NULL,
  `receipt_key` VARCHAR(191),
  `receipt_customer_count` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT `sales_lines_tax_rate_valid`
    CHECK (`tax_rate` IN (8.00, 10.00)),

  CONSTRAINT `sales_lines_line_type_valid`
    CHECK (`line_type` IN ('sale', 'discount', 'void', 'return')),

  CONSTRAINT `sales_lines_receipt_customers_nonnegative`
    CHECK (`receipt_customer_count` >= 0),

  CONSTRAINT `uq_sales_lines_import_source`
    UNIQUE (`import_id`, `source_row_key`),

  CONSTRAINT `fk_sales_lines_sales_day`
    FOREIGN KEY (`sales_day_id`)
    REFERENCES `sales_days` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_sales_lines_product`
    FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_sales_lines_department`
    FOREIGN KEY (`department_id`)
    REFERENCES `store_departments` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_sales_lines_import`
    FOREIGN KEY (`import_id`)
    REFERENCES `sales_imports` (`id`)
    ON DELETE RESTRICT,

  INDEX `sales_lines_day`
    (`sales_day_id`, `transaction_time`),

  INDEX `sales_lines_source_row`
    (`sales_day_id`, `source_row_key`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sales_corrections` (
  `id` CHAR(36) PRIMARY KEY,
  `sales_day_id` CHAR(36) NOT NULL,
  `reason` TEXT NOT NULL,
  `before_amount_yen` BIGINT NOT NULL,
  `after_amount_yen` BIGINT NOT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'pending_area_approval',
  `requested_by` CHAR(36) NOT NULL,
  `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  `pending_sales_day_id` CHAR(36)
    GENERATED ALWAYS AS (
      CASE
        WHEN `status` IN (
          'pending_area_approval',
          'pending_operations_approval'
        )
        THEN `sales_day_id`
        ELSE NULL
      END
    ) STORED,

  CONSTRAINT `sales_corrections_reason_valid`
    CHECK (CHAR_LENGTH(TRIM(`reason`)) BETWEEN 1 AND 500),

  CONSTRAINT `sales_corrections_after_nonnegative`
    CHECK (`after_amount_yen` >= 0),

  CONSTRAINT `uq_sales_corrections_pending_day`
    UNIQUE (`pending_sales_day_id`),

  CONSTRAINT `fk_sales_corrections_sales_day`
    FOREIGN KEY (`sales_day_id`)
    REFERENCES `sales_days` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_sales_corrections_requested_by`
    FOREIGN KEY (`requested_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE RESTRICT,

  INDEX `sales_corrections_pending`
    (`status`, `requested_at`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sales_approvals` (
  `id` CHAR(36) PRIMARY KEY,
  `correction_id` CHAR(36) NOT NULL,
  `approval_stage` VARCHAR(40) NOT NULL,
  `approved` TINYINT(1) NOT NULL,
  `comment` TEXT,
  `actor_id` CHAR(36) NOT NULL,
  `acted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT `sales_approvals_stage_valid`
    CHECK (`approval_stage` IN ('area', 'operations', 'same_day')),

  CONSTRAINT `sales_approvals_comment_valid`
    CHECK (`comment` IS NULL OR CHAR_LENGTH(`comment`) <= 500),

  CONSTRAINT `uq_sales_approvals_stage`
    UNIQUE (`correction_id`, `approval_stage`),

  CONSTRAINT `fk_sales_approvals_correction`
    FOREIGN KEY (`correction_id`)
    REFERENCES `sales_corrections` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_sales_approvals_actor`
    FOREIGN KEY (`actor_id`)
    REFERENCES `app_users` (`id`)
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` CHAR(36) PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `notification_type` VARCHAR(191) NOT NULL,
  `title` TEXT NOT NULL,
  `message` TEXT NOT NULL,
  `read_at` DATETIME(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `correction_id` CHAR(36),

  CONSTRAINT `fk_notifications_correction`
    FOREIGN KEY (`correction_id`)
    REFERENCES `sales_corrections` (`id`)
    ON DELETE SET NULL,

  CONSTRAINT `fk_notifications_user`
    FOREIGN KEY (`user_id`)
    REFERENCES `app_users` (`id`)
    ON DELETE CASCADE,

  CONSTRAINT `uq_correction_notification_once`
    UNIQUE (`user_id`, `correction_id`, `notification_type`),

  INDEX `notifications_user_recent`
    (`user_id`, `created_at`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `batch_runs` (
  `id` CHAR(36) PRIMARY KEY,
  `batch_type` VARCHAR(191) NOT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'received',
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at` DATETIME(3),
  `result_summary` JSON NOT NULL DEFAULT (JSON_OBJECT()),
  `error_summary` TEXT,
  `started_by` CHAR(36),

  CONSTRAINT `fk_batch_runs_started_by`
    FOREIGN KEY (`started_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `orders` (
  `id` CHAR(36) PRIMARY KEY,
  `store_id` CHAR(36) NOT NULL,
  `department_id` CHAR(36) NOT NULL,
  `order_date` DATE NOT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'draft',
  `requested_by` CHAR(36) NOT NULL,
  `requested_delivery_date` DATE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT `orders_status_valid`
    CHECK (
      `status` IN ('draft', 'submitted', 'sent', 'failed', 'cancelled')
    ),

  CONSTRAINT `fk_orders_department`
    FOREIGN KEY (`store_id`, `department_id`)
    REFERENCES `store_departments` (`store_id`, `id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_orders_store`
    FOREIGN KEY (`store_id`)
    REFERENCES `stores` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_orders_requested_by`
    FOREIGN KEY (`requested_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `order_lines` (
  `id` CHAR(36) PRIMARY KEY,
  `order_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `quantity` INT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT `order_lines_quantity_valid`
    CHECK (`quantity` BETWEEN 1 AND 99999),

  CONSTRAINT `uq_order_lines_product`
    UNIQUE (`order_id`, `product_id`),

  CONSTRAINT `fk_order_lines_order`
    FOREIGN KEY (`order_id`)
    REFERENCES `orders` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_order_lines_product`
    FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`)
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `table_name` VARCHAR(191) NOT NULL,
  `record_id` VARCHAR(191) NOT NULL,
  `operation` VARCHAR(40) NOT NULL,
  `actor_id` CHAR(36),
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `before_data` JSON,
  `after_data` JSON,

  CONSTRAINT `audit_logs_operation_valid`
    CHECK (`operation` IN ('INSERT', 'UPDATE', 'DELETE')),

  CONSTRAINT `fk_audit_logs_actor`
    FOREIGN KEY (`actor_id`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL,

  INDEX `audit_logs_record`
    (`table_name`, `record_id`, `occurred_at`),

  INDEX `audit_logs_recent`
    (`occurred_at`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `campaign_items` (
  `id` CHAR(36) PRIMARY KEY,
  `campaign_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `price_yen` INT NOT NULL,
  `eligibility_status` VARCHAR(40) NOT NULL DEFAULT 'not_configured',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT `campaign_items_price_nonnegative`
    CHECK (`price_yen` >= 0),

  CONSTRAINT `campaign_items_eligibility_valid`
    CHECK (
      `eligibility_status`
      IN ('not_configured', 'eligible', 'excluded')
    ),

  CONSTRAINT `uq_campaign_items_product`
    UNIQUE (`campaign_id`, `product_id`),

  CONSTRAINT `uq_campaign_items_campaign_id`
    UNIQUE (`campaign_id`, `id`),

  CONSTRAINT `fk_campaign_items_campaign`
    FOREIGN KEY (`campaign_id`)
    REFERENCES `campaigns` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_campaign_items_product`
    FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`)
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `campaign_item_store_tasks` (
  `campaign_item_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NOT NULL,
  `pos_promotion_status` VARCHAR(40) NOT NULL DEFAULT 'not_configured',
  `pos_promotion_confirmed_at` DATETIME(3),
  `pos_promotion_error` TEXT,
  `price_label_changed_at` DATETIME(3),
  `price_label_changed_by` CHAR(36),
  `pop_changed_at` DATETIME(3),
  `pop_changed_by` CHAR(36),
  `display_changed_at` DATETIME(3),
  `display_changed_by` CHAR(36),
  `pos_restore_status` VARCHAR(40) NOT NULL DEFAULT 'not_configured',
  `pos_restored_at` DATETIME(3),
  `pos_restore_error` TEXT,
  `price_label_restored_at` DATETIME(3),
  `price_label_restored_by` CHAR(36),
  `pop_restored_at` DATETIME(3),
  `pop_restored_by` CHAR(36),
  `display_restored_at` DATETIME(3),
  `display_restored_by` CHAR(36),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`campaign_item_id`, `store_id`),

  CONSTRAINT `campaign_tasks_promotion_status_valid`
    CHECK (
      `pos_promotion_status`
      IN (
        'not_configured',
        'pending',
        'applied',
        'failed',
        'manual_confirmed'
      )
    ),

  CONSTRAINT `campaign_tasks_restore_status_valid`
    CHECK (
      `pos_restore_status`
      IN (
        'not_configured',
        'pending',
        'restored',
        'failed',
        'manual_confirmed'
      )
    ),

  CONSTRAINT `fk_campaign_tasks_item`
    FOREIGN KEY (`campaign_item_id`)
    REFERENCES `campaign_items` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_campaign_tasks_store`
    FOREIGN KEY (`store_id`)
    REFERENCES `stores` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_campaign_tasks_price_changed_by`
    FOREIGN KEY (`price_label_changed_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL,

  CONSTRAINT `fk_campaign_tasks_pop_changed_by`
    FOREIGN KEY (`pop_changed_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL,

  CONSTRAINT `fk_campaign_tasks_display_changed_by`
    FOREIGN KEY (`display_changed_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL,

  CONSTRAINT `fk_campaign_tasks_price_restored_by`
    FOREIGN KEY (`price_label_restored_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL,

  CONSTRAINT `fk_campaign_tasks_pop_restored_by`
    FOREIGN KEY (`pop_restored_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL,

  CONSTRAINT `fk_campaign_tasks_display_restored_by`
    FOREIGN KEY (`display_restored_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL,

  INDEX `campaign_item_store_tasks_store`
    (`store_id`, `campaign_item_id`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `inventory_snapshots` (
  `id` CHAR(36) PRIMARY KEY,
  `store_id` CHAR(36) NOT NULL,
  `department_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `quantity` DECIMAL(14,3) NOT NULL,
  `observed_at` DATETIME(3) NOT NULL,
  `source_reference` VARCHAR(191) NOT NULL,

  CONSTRAINT `uq_inventory_snapshots`
    UNIQUE (`store_id`, `department_id`, `product_id`),

  CONSTRAINT `fk_inventory_snapshots_department`
    FOREIGN KEY (`store_id`, `department_id`)
    REFERENCES `store_departments` (`store_id`, `id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_inventory_snapshots_store`
    FOREIGN KEY (`store_id`)
    REFERENCES `stores` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_inventory_snapshots_product`
    FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`)
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `store_announcements` (
  `id` CHAR(36) PRIMARY KEY,
  `store_id` CHAR(36) NOT NULL,
  `title` TEXT NOT NULL,
  `message` TEXT NOT NULL,
  `created_by` CHAR(36),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT `store_announcements_title_valid`
    CHECK (CHAR_LENGTH(TRIM(`title`)) BETWEEN 1 AND 200),

  CONSTRAINT `store_announcements_message_valid`
    CHECK (CHAR_LENGTH(TRIM(`message`)) BETWEEN 1 AND 2000),

  CONSTRAINT `fk_store_announcements_store`
    FOREIGN KEY (`store_id`)
    REFERENCES `stores` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_store_announcements_created_by`
    FOREIGN KEY (`created_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `store_devices` (
  `id` CHAR(36) PRIMARY KEY,
  `store_id` CHAR(36) NOT NULL,
  `name` TEXT NOT NULL,
  `token_hash` BINARY(32) NOT NULL UNIQUE,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` CHAR(36),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT `store_devices_name_valid`
    CHECK (CHAR_LENGTH(TRIM(`name`)) BETWEEN 1 AND 100),

  CONSTRAINT `fk_store_devices_store`
    FOREIGN KEY (`store_id`)
    REFERENCES `stores` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_store_devices_created_by`
    FOREIGN KEY (`created_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `integration_jobs` (
  `id` CHAR(36) PRIMARY KEY,
  `kind` VARCHAR(40) NOT NULL,
  `idempotency_key` VARCHAR(191) NOT NULL UNIQUE,
  `payload` JSON NOT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'pending',
  `attempts` INT NOT NULL DEFAULT 0,
  `lease_id` CHAR(36),
  `locked_until` DATETIME(3),
  `available_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_error` TEXT,
  `result` JSON,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT `integration_jobs_kind_valid`
    CHECK (
      `kind` IN (
        'order',
        'campaign_price',
        'campaign_restore',
        'sales_import'
      )
    ),

  CONSTRAINT `integration_jobs_status_valid`
    CHECK (
      `status` IN ('pending', 'processing', 'completed', 'failed')
    ),

  CONSTRAINT `integration_jobs_attempts_nonnegative`
    CHECK (`attempts` >= 0),

  INDEX `integration_jobs_pending`
    (`status`, `available_at`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `integration_receipts` (
  `event_id` VARCHAR(191) PRIMARY KEY,
  `content_hash` BINARY(32) NOT NULL,
  `kind` VARCHAR(191) NOT NULL,
  `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `store_instructions` (
  `id` CHAR(36) PRIMARY KEY,
  `request_id` CHAR(36) NOT NULL UNIQUE,
  `kind` VARCHAR(40) NOT NULL,
  `title` TEXT NOT NULL,
  `message` TEXT NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `price_yen` INT NOT NULL,
  `effective_at` DATETIME(3) NOT NULL,
  `created_by` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT `store_instructions_kind_valid`
    CHECK (`kind` IN ('promotion', 'price_change')),

  CONSTRAINT `store_instructions_title_valid`
    CHECK (CHAR_LENGTH(TRIM(`title`)) BETWEEN 1 AND 200),

  CONSTRAINT `store_instructions_message_valid`
    CHECK (CHAR_LENGTH(TRIM(`message`)) BETWEEN 1 AND 2000),

  CONSTRAINT `store_instructions_price_nonnegative`
    CHECK (`price_yen` >= 0),

  CONSTRAINT `fk_store_instructions_product`
    FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_store_instructions_created_by`
    FOREIGN KEY (`created_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `store_instruction_targets` (
  `instruction_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NOT NULL,
  `confirmed_by` CHAR(36),
  `confirmed_at` DATETIME(3),

  PRIMARY KEY (`instruction_id`, `store_id`),

  CONSTRAINT `fk_store_instruction_targets_instruction`
    FOREIGN KEY (`instruction_id`)
    REFERENCES `store_instructions` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_store_instruction_targets_store`
    FOREIGN KEY (`store_id`)
    REFERENCES `stores` (`id`)
    ON DELETE RESTRICT,

  CONSTRAINT `fk_store_instruction_targets_confirmed_by`
    FOREIGN KEY (`confirmed_by`)
    REFERENCES `app_users` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `app_credentials` (
  `user_id` CHAR(36) PRIMARY KEY,
  `password_hash` VARCHAR(128) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL
    DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  CONSTRAINT `fk_credentials_user`
    FOREIGN KEY (`user_id`)
    REFERENCES `app_users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;
  