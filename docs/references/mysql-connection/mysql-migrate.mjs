import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

const required = ["MYSQL_HOST", "MYSQL_DATABASE", "MYSQL_USER"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`MySQL接続設定が不足しています: ${missing.join(", ")}`);
const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE || "minoriya_starter",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "P@ssw0rd",
  charset: "utf8mb4",
  timezone: "+09:00",
});
try {
  await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(191) PRIMARY KEY,
    checksum CHAR(64) NOT NULL,
    applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const dir = resolve("database/mysql/migrations");
  for (const file of (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort()) {
    const sql = await readFile(resolve(dir, file), "utf8");
    const { createHash } = await import("node:crypto");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const [rows] = await connection.execute("SELECT checksum FROM schema_migrations WHERE version=?", [file]);
    if (rows.length) {
      if (rows[0].checksum !== checksum) throw new Error(`${file}は適用済みのため編集できません。新しいマイグレーションを追加してください。`);
      continue;
    }
    for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
      try { await connection.query(statement); }
      catch (error) {
        if (error?.code !== "ER_DUP_KEYNAME") throw error;
      }
    }
    await connection.execute("INSERT INTO schema_migrations(version,checksum) VALUES(?,?)", [file, checksum]);
    console.log(`Applied ${file}`);
  }
} finally {
  await connection.end();
}
