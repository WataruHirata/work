import { scryptSync, timingSafeEqual } from "node:crypto";
import mysql from "mysql2/promise";

if (process.env.DATABASE_PROVIDER !== "mysql") {
  throw new Error("DATABASE_PROVIDER=mysql を設定してください。");
}

const db = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD || "",
  charset: "utf8mb4",
  timezone: "+09:00",
});

const checks = [
  ["stores", "status", "id", "20000000-%", ["active", "closed", "temporarily_closed"]],
  [
    "products",
    "promotion_eligibility",
    "id",
    "40000000-%",
    ["eligible", "excluded", "not_configured"],
  ],
  ["sales_days", "status", "id", "60000000-%", ["confirmed", "imported", "monthly_finalized"]],
  [
    "sales_corrections",
    "status",
    "id",
    "64000000-%",
    ["approved", "pending_area_approval", "pending_operations_approval", "rejected"],
  ],
  ["orders", "status", "id", "90000000-%", ["cancelled", "draft", "failed", "sent", "submitted"]],
  [
    "campaign_items",
    "eligibility_status",
    "id",
    "81000000-%",
    ["eligible", "excluded", "not_configured"],
  ],
  [
    "campaign_item_store_tasks",
    "pos_promotion_status",
    "campaign_item_id",
    "81000000-%",
    ["applied", "failed", "manual_confirmed", "not_configured", "pending"],
  ],
  [
    "campaign_item_store_tasks",
    "pos_restore_status",
    "campaign_item_id",
    "81000000-%",
    ["failed", "manual_confirmed", "not_configured", "pending", "restored"],
  ],
  [
    "integration_jobs",
    "status",
    "id",
    "92000000-%",
    ["completed", "failed", "pending", "processing"],
  ],
];

try {
  for (const [table, column, key, pattern, expected] of checks) {
    const [rows] = await db.query(
      `SELECT ${column} AS state, COUNT(*) AS count FROM ${table} WHERE ${key} LIKE ? GROUP BY ${column} ORDER BY ${column}`,
      [pattern],
    );
    const actual = rows.map(({ state }) => state);
    for (const state of expected) {
      if (!actual.includes(state))
        throw new Error(
          `${table}.${column} に ${state} がありません。MySQLデモデータが未登録または不足しています。npm run db:mysql:demo を実行してから再確認してください。`,
        );
    }
    console.log(
      `${table}.${column}: ${rows.map(({ state, count }) => `${state}=${count}`).join(", ")}`,
    );
  }
  const [notificationRows] = await db.query(
    "SELECT SUM(read_at IS NULL) AS unread_count, SUM(read_at IS NOT NULL) AS read_count FROM notifications WHERE id LIKE '66000000-%'",
  );
  const notificationState = notificationRows[0];
  if (!Number(notificationState.unread_count) || !Number(notificationState.read_count)) {
    throw new Error("通知の既読・未読データが揃っていません。");
  }
  console.log(
    `notifications.read_state: unread=${notificationState.unread_count}, read=${notificationState.read_count}`,
  );
  const [storeFixtureRows] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM store_announcements WHERE store_id='20000000-0000-4000-8000-000000000001') AS announcements,
      (SELECT COUNT(*) FROM sales_lines line JOIN sales_days day ON day.id=line.sales_day_id
        WHERE day.store_id='20000000-0000-4000-8000-000000000001'
          AND day.business_date=(SELECT MAX(business_date) FROM sales_days WHERE store_id=day.store_id)) AS latest_sales_lines,
      (SELECT net_sales_yen FROM sales_days
        WHERE store_id='20000000-0000-4000-8000-000000000001'
        ORDER BY business_date DESC LIMIT 1) AS latest_net_sales,
      (SELECT SUM(line.amount_yen) FROM sales_lines line JOIN sales_days day ON day.id=line.sales_day_id
        WHERE day.store_id='20000000-0000-4000-8000-000000000001'
          AND day.business_date=(SELECT MAX(business_date) FROM sales_days WHERE store_id=day.store_id)) AS latest_line_total,
      (SELECT COUNT(*) FROM (
        SELECT line.product_code_snapshot
        FROM sales_lines line JOIN sales_days day ON day.id=line.sales_day_id
        WHERE day.store_id='20000000-0000-4000-8000-000000000001'
          AND day.business_date=(SELECT MAX(business_date) FROM sales_days WHERE store_id=day.store_id)
        GROUP BY line.product_code_snapshot
        HAVING SUM(line.amount_yen)<=0
      ) invalid_composition) AS invalid_composition_items
  `);
  if (
    Number(storeFixtureRows[0].announcements) < 6 ||
    Number(storeFixtureRows[0].latest_sales_lines) < 6 ||
    Number(storeFixtureRows[0].latest_line_total) !==
      Number(storeFixtureRows[0].latest_net_sales) ||
    Number(storeFixtureRows[0].invalid_composition_items) > 0
  ) {
    throw new Error("右上通知・直近売上明細・品目別売上構成の表示確認用データが不正です。");
  }
  console.log(
    "store_portal.fixture: announcements>=6, latest_sales_lines>=6, sales_composition=net_sales",
  );
  const scaleRequirements = [
    ["stores", "id", "20000000-%", 180],
    ["products", "id", "40000000-%", 1200],
    ["store_products", "product_id", "40000000-%", 1200],
    ["product_prices", "id", "41000000-%", 1200],
    ["sales_days", "id", "60000000-%", 5400],
    ["sales_lines", "id", "61000000-%", 32400],
    ["inventory_snapshots", "id", "62000000-%", 1440],
  ];
  for (const [table, key, pattern, minimum] of scaleRequirements) {
    const [rows] = await db.query(`SELECT COUNT(*) AS count FROM ${table} WHERE ${key} LIKE ?`, [
      pattern,
    ]);
    const count = Number(rows[0].count);
    if (count < minimum) {
      throw new Error(
        `${table} がスケールデータの最低件数 ${minimum} 件に達していません（${count}件）。`,
      );
    }
    console.log(`${table}.scale_fixture: ${count} rows (minimum ${minimum})`);
  }
  const [orderCatalogRows] = await db.query(`
    SELECT COUNT(DISTINCT product.id) AS count
    FROM products product
    JOIN store_products stock
      ON stock.product_id=product.id
     AND stock.store_id='20000000-0000-4000-8000-000000000001'
     AND stock.active=1
    WHERE product.active=1
      AND EXISTS (
        SELECT 1 FROM product_prices price
        WHERE price.product_id=product.id
          AND (price.store_id=stock.store_id OR price.store_id IS NULL)
          AND price.valid_from<=CURRENT_TIMESTAMP(3)
          AND (price.valid_until IS NULL OR price.valid_until>CURRENT_TIMESTAMP(3))
      )
  `);
  const orderCatalogCount = Number(orderCatalogRows[0].count);
  if (orderCatalogCount < 1000) {
    throw new Error(`発注可能商品が最低件数 1000 件に達していません（${orderCatalogCount}件）。`);
  }
  console.log(`order_catalog.scale_fixture: ${orderCatalogCount} products (minimum 1000)`);
  const [diversityRows] = await db.query(`
    SELECT
      (SELECT COUNT(DISTINCT status) FROM stores WHERE id LIKE '20000000-%') AS store_statuses,
      (SELECT COUNT(DISTINCT opening_time) FROM stores WHERE id LIKE '20000000-%') AS opening_times,
      (SELECT COUNT(DISTINCT category_code) FROM products WHERE id LIKE '40000000-%') AS product_categories,
      (SELECT COUNT(DISTINCT tax_rate) FROM products WHERE id LIKE '40000000-%') AS tax_rates,
      (SELECT COUNT(DISTINCT promotion_eligibility) FROM products WHERE id LIKE '40000000-%') AS eligibility_states,
      (SELECT COUNT(DISTINCT status) FROM sales_days WHERE id LIKE '60000000-%') AS sales_day_statuses,
      (SELECT COUNT(DISTINCT line_type) FROM sales_lines WHERE id LIKE '61000000-%') AS sales_line_types,
      (SELECT SUM(amount_yen < 0) FROM sales_lines WHERE id LIKE '61000000-%') AS negative_sales_lines,
      (SELECT SUM(quantity = 0) FROM inventory_snapshots WHERE id LIKE '62000000-%') AS zero_inventory_rows,
      (SELECT MAX(CHAR_LENGTH(name)) FROM products WHERE id LIKE '40000000-%') AS longest_product_name
  `);
  const diversity = diversityRows[0];
  const diversityMinimums = {
    store_statuses: 3,
    opening_times: 4,
    product_categories: 6,
    tax_rates: 2,
    eligibility_states: 3,
    sales_day_statuses: 3,
    sales_line_types: 4,
    negative_sales_lines: 1,
    zero_inventory_rows: 1,
    longest_product_name: 40,
  };
  for (const [field, minimum] of Object.entries(diversityMinimums)) {
    if (Number(diversity[field]) < minimum)
      throw new Error(
        `表示確認用の分散データ ${field} が不足しています（${diversity[field]}、最低 ${minimum}）。`,
      );
  }
  console.log("scale_fixture.diversity: store, product, sales, and inventory variations=ready");
  const [authRows] = await db.query(
    "SELECT u.active,u.password_hash,r.role FROM app_users u JOIN user_role_assignments r ON r.user_id=u.id WHERE LOWER(u.email)=LOWER(?)",
    ["minoriya-demo+information_systems@example.invalid"],
  );
  const authUser = authRows[0];
  const expectedHash = scryptSync(
    "Demo!4f415f02764eedff91f594ee05862d5e877ba9",
    "minoriya-local-mysql-auth",
    64,
  );
  const actualHash = Buffer.from(authUser?.password_hash ?? "", "hex");
  if (
    !authUser?.active ||
    authUser.role !== "information_systems" ||
    actualHash.length !== expectedHash.length ||
    !timingSafeEqual(actualHash, expectedHash)
  ) {
    throw new Error("MySQL認証用のデモアカウントが正しくありません。");
  }
  console.log("authentication.fixture: active information_systems user=ready");
  console.log("MySQL rich demo fixture verification passed.");
} finally {
  await db.end();
}
