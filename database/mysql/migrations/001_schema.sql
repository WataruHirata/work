-- MySQL 8.4 InnoDB schema for the application data contract.

-- This contains tables only; command transactions are implemented in TypeScript.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `areas` (
  id CHAR(36) PRIMARY KEY ,
  code VARCHAR(191) not null unique,
  name TEXT not null,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  CONSTRAINT `area_code_not_blank` check (length(trim(code)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `stores` (
  id CHAR(36) PRIMARY KEY ,
  area_id CHAR(36) not null ,
  code VARCHAR(191) not null unique,
  name TEXT not null,
  timezone VARCHAR(191) not null default 'Asia/Tokyo',
  business_day_starts_at time not null default '22:30',
  closing_time time not null default '22:30',
  status VARCHAR(40) not null default 'active',
  has_dine_in TINYINT(1) not null DEFAULT 0,
  opened_on date,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  CONSTRAINT `store_code_not_blank` check (length(trim(code)) > 0),
  opening_time TIME NOT NULL DEFAULT '09:00',
  FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `app_users` (
  id CHAR(36) PRIMARY KEY ,
  display_name TEXT not null,
  active TINYINT(1) not null DEFAULT 1,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  CONSTRAINT `app_user_name_not_blank` check (length(trim(display_name)) > 0),
  email VARCHAR(254) UNIQUE,
  employee_code VARCHAR(100) UNIQUE,
  affiliation VARCHAR(191),
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  password_hash VARCHAR(128) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `store_departments` (
  id CHAR(36) PRIMARY KEY ,
  store_id CHAR(36) not null ,
  code VARCHAR(191) not null,
  name TEXT not null,
  active TINYINT(1) not null DEFAULT 1,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  UNIQUE (store_id, code),
  UNIQUE (store_id, id),
  FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `user_role_assignments` (
  id CHAR(36) PRIMARY KEY ,
  user_id CHAR(36) not null ,
  role VARCHAR(40) not null,
  area_id CHAR(36) ,
  store_id CHAR(36) ,
  department_id CHAR(36),
  assigned_by CHAR(36) ,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  CONSTRAINT `role_scope_is_unambiguous` check (area_id is null or store_id is null),
  CONSTRAINT `department_role_requires_store` check (
    department_id is null or (store_id is not null and area_id is null)
  ),
  CONSTRAINT `role_scope_matches_role` check (
    (role = 'area_manager' and area_id is not null and store_id is null and department_id is null)
    or (role = 'store_manager' and store_id is not null and department_id is null)
    or (role in ('department_lead', 'staff') and store_id is not null and department_id is not null)
    or (
      role in ('product_office', 'store_operations', 'information_systems', 'accounting')
      and area_id is null and store_id is null and department_id is null
    )
  ),
  FOREIGN KEY (`store_id`, `department_id`) REFERENCES `store_departments` (`store_id`, `id`) ON DELETE RESTRICT,
  UNIQUE (user_id, role, area_id, store_id, department_id),
  area_scope_key CHAR(36) GENERATED ALWAYS AS (IFNULL(area_id, '00000000-0000-0000-0000-000000000000')) STORED,
  store_scope_key CHAR(36) GENERATED ALWAYS AS (IFNULL(store_id, '00000000-0000-0000-0000-000000000000')) STORED,
  department_scope_key CHAR(36) GENERATED ALWAYS AS (IFNULL(department_id, '00000000-0000-0000-0000-000000000000')) STORED,
  UNIQUE (user_id, role, area_scope_key, store_scope_key, department_scope_key),
  FOREIGN KEY (`user_id`) REFERENCES `app_users` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`assigned_by`) REFERENCES `app_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `products` (
  id CHAR(36) PRIMARY KEY ,
  code VARCHAR(191) not null unique,
  name TEXT not null,
  category_code VARCHAR(191),
  tax_rate numeric(4, 2) not null check (tax_rate in (8, 10)),
  active TINYINT(1) not null DEFAULT 1,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  CONSTRAINT `product_code_not_blank` check (length(trim(code)) > 0),
  CONSTRAINT `product_name_length` check (char_length(name) between 1 and 200),
  promotion_eligibility VARCHAR(32) NOT NULL DEFAULT 'not_configured'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `product_prices` (
  id CHAR(36) PRIMARY KEY ,
  product_id CHAR(36) not null ,
  store_id CHAR(36) ,
  price_yen integer not null check (price_yen >= 0),
  valid_from DATETIME(3) not null,
  valid_until DATETIME(3),
  created_by CHAR(36) ,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  CONSTRAINT `product_price_period_valid` check (valid_until is null or valid_until > valid_from),
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`created_by`) REFERENCES `app_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `store_products` (
  store_id CHAR(36) not null ,
  product_id CHAR(36) not null ,
  shelf_location TEXT,
  active TINYINT(1) not null DEFAULT 1,
  updated_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  PRIMARY KEY (store_id, product_id),
  FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `campaigns` (
  id CHAR(36) PRIMARY KEY ,
  name TEXT not null,
  product_id CHAR(36) not null ,
  price_yen integer not null check (price_yen >= 0),
  starts_at DATETIME(3) not null,
  ends_at DATETIME(3) not null,
  status VARCHAR(40) not null default 'draft',
  created_by CHAR(36) ,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  CONSTRAINT `campaign_period_valid` check (ends_at > starts_at),
  CONSTRAINT `campaign_name_not_blank` check (length(trim(name)) > 0),
  published_at DATETIME(3),
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`created_by`) REFERENCES `app_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `campaign_store_targets` (
  campaign_id CHAR(36) not null ,
  store_id CHAR(36) not null ,
  applied_at DATETIME(3),
  restored_at DATETIME(3),
  last_error TEXT,
  updated_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  PRIMARY KEY (campaign_id, store_id),
  CONSTRAINT `campaign_target_restore_after_apply` check (
    restored_at is null or applied_at is not null
  ),
  store_confirmed_at DATETIME(3),
  store_confirmed_by CHAR(36),
  FOREIGN KEY (`store_confirmed_by`) REFERENCES `app_users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sales_imports` (
  id CHAR(36) PRIMARY KEY ,
  source_file_name TEXT not null,
  source_checksum VARCHAR(191) not null unique,
  status VARCHAR(40) not null default 'received',
  received_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3),
  rows_received integer not null default 0 check (rows_received >= 0),
  error_summary TEXT,
  started_by CHAR(36) ,
  FOREIGN KEY (`started_by`) REFERENCES `app_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `store_sales_imports` (
  id CHAR(36) PRIMARY KEY ,
  import_id CHAR(36) not null ,
  store_id CHAR(36) not null ,
  business_date date not null,
  status VARCHAR(40) not null default 'received',
  rows_received integer not null default 0 check (rows_received >= 0),
  completed_at DATETIME(3),
  error_summary TEXT,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  UNIQUE (import_id, store_id, business_date),
  FOREIGN KEY (`import_id`) REFERENCES `sales_imports` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sales_days` (
  id CHAR(36) PRIMARY KEY ,
  store_id CHAR(36) not null ,
  business_date date not null,
  status VARCHAR(40) not null default 'imported',
  gross_sales_yen bigint not null default 0 check (gross_sales_yen >= 0),
  net_sales_yen bigint not null default 0 check (net_sales_yen >= 0),
  transaction_count integer not null default 0 check (transaction_count >= 0),
  customer_count integer not null default 0 check (customer_count >= 0),
  imported_at DATETIME(3),
  confirmed_by CHAR(36) ,
  confirmed_at DATETIME(3),
  monthly_finalized_by CHAR(36) ,
  monthly_finalized_at DATETIME(3),
  import_id CHAR(36) ,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  UNIQUE (store_id, business_date),
  CONSTRAINT `sales_day_confirmation_consistent` check (
    (status = 'imported' and confirmed_at is null and monthly_finalized_at is null)
    or (status = 'confirmed' and confirmed_at is not null and monthly_finalized_at is null)
    or (status = 'monthly_finalized' and confirmed_at is not null and monthly_finalized_at is not null)
  ),
  FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`confirmed_by`) REFERENCES `app_users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`monthly_finalized_by`) REFERENCES `app_users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`import_id`) REFERENCES `sales_imports` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sales_lines` (
  id CHAR(36) PRIMARY KEY ,
  sales_day_id CHAR(36) not null ,
  product_id CHAR(36) ,
  product_code_snapshot VARCHAR(191) not null,
  product_name_snapshot TEXT not null,
  department_id CHAR(36) ,
  quantity numeric(12, 3) not null,
  amount_yen bigint not null,
  tax_rate numeric(4, 2) not null check (tax_rate in (8, 10)),
  transaction_time DATETIME(3) not null,
  line_type VARCHAR(191) not null check (line_type in ('sale', 'discount', 'void', 'return')),
  source_row_key TEXT not null,
  import_id CHAR(36) not null ,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  UNIQUE (import_id, source_row_key),
  receipt_key VARCHAR(191),
  receipt_customer_count INT NOT NULL DEFAULT 0,
  FOREIGN KEY (`sales_day_id`) REFERENCES `sales_days` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`department_id`) REFERENCES `store_departments` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`import_id`) REFERENCES `sales_imports` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sales_corrections` (
  id CHAR(36) PRIMARY KEY ,
  sales_day_id CHAR(36) not null ,
  reason TEXT not null check (char_length(trim(reason)) between 1 and 500),
  before_amount_yen bigint not null,
  after_amount_yen bigint not null check (after_amount_yen >= 0),
  status VARCHAR(40) not null default 'pending_area_approval',
  requested_by CHAR(36) not null ,
  requested_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  pending_sales_day_id CHAR(36) GENERATED ALWAYS AS (CASE WHEN status IN ('pending_area_approval','pending_operations_approval') THEN sales_day_id ELSE NULL END) STORED,
  UNIQUE (pending_sales_day_id),
  FOREIGN KEY (`sales_day_id`) REFERENCES `sales_days` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`requested_by`) REFERENCES `app_users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sales_approvals` (
  id CHAR(36) PRIMARY KEY ,
  correction_id CHAR(36) not null ,
  approval_stage TEXT not null check (approval_stage in ('area', 'operations', 'same_day')),
  approved TINYINT(1) not null,
  comment TEXT check (comment is null or char_length(comment) <= 500),
  actor_id CHAR(36) not null ,
  acted_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  UNIQUE (correction_id, approval_stage),
  FOREIGN KEY (`correction_id`) REFERENCES `sales_corrections` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`actor_id`) REFERENCES `app_users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  id CHAR(36) PRIMARY KEY ,
  user_id CHAR(36) not null ,
  notification_type TEXT not null,
  title TEXT not null,
  message TEXT not null,
  read_at DATETIME(3),
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  correction_id CHAR(36),
  FOREIGN KEY (`correction_id`) REFERENCES `sales_corrections` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`user_id`) REFERENCES `app_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `batch_runs` (
  id CHAR(36) PRIMARY KEY ,
  batch_type TEXT not null,
  status VARCHAR(40) not null default 'received',
  started_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3),
  result_summary JSON not null default '{}'::JSON,
  error_summary TEXT,
  started_by CHAR(36) ,
  FOREIGN KEY (`started_by`) REFERENCES `app_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `orders` (
  id CHAR(36) PRIMARY KEY ,
  store_id CHAR(36) not null ,
  department_id CHAR(36) not null,
  order_date date not null,
  status VARCHAR(191) not null default 'draft'
    check (status in ('draft', 'submitted', 'sent', 'failed', 'cancelled')),
  requested_by CHAR(36) not null ,
  requested_delivery_date date,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  FOREIGN KEY (`store_id`, `department_id`) REFERENCES `store_departments` (`store_id`, `id`) ON DELETE RESTRICT,
  FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`requested_by`) REFERENCES `app_users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `order_lines` (
  id CHAR(36) PRIMARY KEY ,
  order_id CHAR(36) not null ,
  product_id CHAR(36) not null ,
  quantity integer not null check (quantity between 1 and 99999),
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  UNIQUE (order_id, product_id),
  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(191) not null,
  record_id VARCHAR(191) not null,
  operation VARCHAR(191) not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id CHAR(36) ,
  occurred_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  before_data JSON,
  after_data JSON,
  FOREIGN KEY (`actor_id`) REFERENCES `app_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `campaign_items` (
  id CHAR(36) PRIMARY KEY ,
  campaign_id CHAR(36) not null ,
  product_id CHAR(36) not null ,
  price_yen integer not null check (price_yen >= 0),
  eligibility_status VARCHAR(191) not null default 'not_configured'
    check (eligibility_status in ('not_configured', 'eligible', 'excluded')),
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  UNIQUE (campaign_id, product_id),
  UNIQUE (campaign_id, id),
  FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `campaign_item_store_tasks` (
  campaign_item_id CHAR(36) not null ,
  store_id CHAR(36) not null ,
  pos_promotion_status VARCHAR(191) not null default 'not_configured'
    check (pos_promotion_status in ('not_configured', 'pending', 'applied', 'failed', 'manual_confirmed')),
  pos_promotion_confirmed_at DATETIME(3),
  pos_promotion_error TEXT,
  price_label_changed_at DATETIME(3),
  price_label_changed_by CHAR(36) ,
  pop_changed_at DATETIME(3),
  pop_changed_by CHAR(36) ,
  display_changed_at DATETIME(3),
  display_changed_by CHAR(36) ,
  pos_restore_status VARCHAR(191) not null default 'not_configured'
    check (pos_restore_status in ('not_configured', 'pending', 'restored', 'failed', 'manual_confirmed')),
  pos_restored_at DATETIME(3),
  pos_restore_error TEXT,
  price_label_restored_at DATETIME(3),
  price_label_restored_by CHAR(36) ,
  pop_restored_at DATETIME(3),
  pop_restored_by CHAR(36) ,
  display_restored_at DATETIME(3),
  display_restored_by CHAR(36) ,
  updated_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  PRIMARY KEY (campaign_item_id, store_id),
  FOREIGN KEY (`campaign_item_id`) REFERENCES `campaign_items` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`price_label_changed_by`) REFERENCES `app_users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`pop_changed_by`) REFERENCES `app_users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`display_changed_by`) REFERENCES `app_users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`price_label_restored_by`) REFERENCES `app_users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`pop_restored_by`) REFERENCES `app_users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`display_restored_by`) REFERENCES `app_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `inventory_snapshots` (
  id CHAR(36) PRIMARY KEY ,
  store_id CHAR(36) not null ,
  department_id CHAR(36) not null,
  product_id CHAR(36) not null ,
  quantity numeric(14,3) not null,
  observed_at DATETIME(3) not null,
  source_reference VARCHAR(191) not null,
  FOREIGN KEY (`store_id`, `department_id`) REFERENCES `store_departments` (`store_id`, `id`),
  UNIQUE (store_id,department_id,product_id),
  FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`),
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `store_announcements` (
  id CHAR(36) PRIMARY KEY ,
  store_id CHAR(36) not null ,
  title TEXT not null check(length(trim(title)) between 1 and 200),
  message TEXT not null check(length(trim(message)) between 1 and 2000),
  created_by CHAR(36) ,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`),
  FOREIGN KEY (`created_by`) REFERENCES `app_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `store_devices` (
  id CHAR(36) PRIMARY KEY ,
  store_id CHAR(36) not null ,
  name TEXT not null check(length(trim(name)) between 1 and 100),
  token_hash BINARY(32) not null unique,
  active TINYINT(1) not null DEFAULT 1,
  created_by CHAR(36) ,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`),
  FOREIGN KEY (`created_by`) REFERENCES `app_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `integration_jobs` (
  id CHAR(36) PRIMARY KEY ,
  kind VARCHAR(191) not null check(kind in ('order','campaign_price','campaign_restore','sales_import')),
  idempotency_key VARCHAR(191) not null unique,
  payload JSON not null,
  status VARCHAR(191) not null default 'pending' check(status in ('pending','processing','completed','failed')),
  attempts integer not null default 0,
  lease_id CHAR(36),
  locked_until DATETIME(3),
  available_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  last_error TEXT,
  result JSON,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) not null default CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `integration_receipts` (
  event_id VARCHAR(191) PRIMARY KEY,
  content_hash BINARY(32) not null,
  kind VARCHAR(191) not null,
  received_at DATETIME(3) not null default CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `store_instructions` (
  id CHAR(36) PRIMARY KEY ,
  request_id CHAR(36) not null unique,
  kind VARCHAR(191) not null check(kind in ('promotion','price_change')),
  title TEXT not null check(length(trim(title)) between 1 and 200),
  message TEXT not null check(length(trim(message)) between 1 and 2000),
  product_id CHAR(36) not null ,
  price_yen integer not null check(price_yen >= 0),
  effective_at DATETIME(3) not null,
  created_by CHAR(36) not null ,
  created_at DATETIME(3) not null default CURRENT_TIMESTAMP(3),
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  FOREIGN KEY (`created_by`) REFERENCES `app_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `store_instruction_targets` (
  instruction_id CHAR(36) not null ,
  store_id CHAR(36) not null ,
  confirmed_by CHAR(36) ,
  confirmed_at DATETIME(3),
  PRIMARY KEY(instruction_id,store_id),
  FOREIGN KEY (`instruction_id`) REFERENCES `store_instructions` (`id`),
  FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`),
  FOREIGN KEY (`confirmed_by`) REFERENCES `app_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE INDEX `product_prices_lookup` ON `product_prices` (`product_id`, `store_id`, `valid_from`);

CREATE INDEX `store_sales_imports_monitoring` ON `store_sales_imports` (`status`, `business_date`, `store_id`);

CREATE INDEX `sales_days_date_store` ON `sales_days` (`business_date`, `store_id`);

CREATE INDEX `sales_lines_day` ON `sales_lines` (`sales_day_id`, `transaction_time`);

CREATE INDEX `sales_corrections_pending` ON `sales_corrections` (`status`, `requested_at`);

CREATE INDEX `notifications_user_recent` ON `notifications` (`user_id`, `created_at`);

CREATE INDEX `audit_logs_record` ON `audit_logs` (`table_name`, `record_id`, `occurred_at`);

CREATE INDEX `audit_logs_recent` ON `audit_logs` (`occurred_at`);

CREATE INDEX `campaign_item_store_tasks_store` ON `campaign_item_store_tasks` (`store_id`, `campaign_item_id`);

CREATE INDEX `integration_jobs_pending` ON `integration_jobs` (`status`, `available_at`);

CREATE INDEX `sales_lines_source_row` ON `sales_lines` (`sales_day_id`, `source_row_key`);

CREATE UNIQUE INDEX `correction_notification_once` ON `notifications` (`user_id`, `correction_id`, `notification_type`);

CREATE TABLE IF NOT EXISTS `integration_receipts` (`event_id` VARCHAR(191) PRIMARY KEY, `content_hash` BINARY(32) NOT NULL, `kind` VARCHAR(40) NOT NULL, `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `app_credentials` (`user_id` CHAR(36) PRIMARY KEY, `password_hash` VARCHAR(128) NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), CONSTRAINT `fk_credentials_user` FOREIGN KEY (`user_id`) REFERENCES `app_users` (`id`) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
