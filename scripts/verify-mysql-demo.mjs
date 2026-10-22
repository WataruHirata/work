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
      if (!actual.includes(state)) throw new Error(`${table}.${column} に ${state} がありません。`);
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
