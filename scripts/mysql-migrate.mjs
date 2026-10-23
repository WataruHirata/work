import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

const required = ["MYSQL_HOST", "MYSQL_DATABASE", "MYSQL_USER"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`MySQL接続設定が不足しています: ${missing.join(", ")}`);
const port = Number(process.env.MYSQL_PORT || 3306);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("MYSQL_PORTには1から65535の整数を設定してください。");
const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port,
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD || "",
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
    // One historic migration was applied with a whitespace-only final line and no EOL.
    // Accept only that byte-level legacy variant; substantive edits still fail closed.
    const acceptedChecksums = [checksum];
    if (file === "002_fix_campaign_status_constraint.sql")
      acceptedChecksums.push(
        createHash("sha256")
          .update(sql.replace(/\r?\n$/, "$&  "))
          .digest("hex"),
      );
    const [rows] = await connection.execute(
      "SELECT checksum FROM schema_migrations WHERE version=?",
      [file],
    );
    if (rows.length) {
      if (!acceptedChecksums.includes(rows[0].checksum))
        throw new Error(
          `${file}は適用済みのため編集できません。新しいマイグレーションを追加してください。`,
        );
      continue;
    }
    // MySQL's `--` comment handling depends on a following whitespace character.
    // Strip whole-line comments before splitting DDL into statements so comments
    // at the beginning of a file are never sent as part of a query.
    const executableSql = sql.replace(/^\s*(?:--|#).*$/gm, "");
    for (const statement of executableSql
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)) {
      try {
        await connection.query(statement);
      } catch (error) {
        if (error?.code !== "ER_DUP_KEYNAME") throw error;
      }
    }
    await connection.execute("INSERT INTO schema_migrations(version,checksum) VALUES(?,?)", [
      file,
      checksum,
    ]);
    console.log(`Applied ${file}`);
  }
} finally {
  await connection.end();
}
