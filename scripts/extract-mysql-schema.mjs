import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const migrationsDir = resolve("supabase/migrations");
const outputDir = resolve("database/mysql/migrations");
await mkdir(outputDir, { recursive: true });
const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
const tables = new Map();
const indexes = [];
for (const file of files) {
  const sql = await readFile(resolve(migrationsDir, file), "utf8");
  for (const index of sql.matchAll(/create\s+(unique\s+)?index\s+([a-z_]+)\s+on\s+public\.([a-z_]+)\s*\(([^)]+)\)(?:\s+where\s+[^;]+)?;/gi)) {
    indexes.push({ unique: Boolean(index[1]), name: index[2], table: index[3], columns: index[4].replace(/\s+desc\b/gi, "").replace(/\s+asc\b/gi, "") });
  }
  const matcher = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_]+)\s*\(/gi;
  for (const match of sql.matchAll(matcher)) {
    let start = match.index + match[0].length - 1;
    let depth = 0;
    let quote = false;
    let end = start;
    for (; end < sql.length; end++) {
      const char = sql[end];
      if (char === "'" && sql[end - 1] !== "\\") quote = !quote;
      if (quote) continue;
      if (char === "(") depth++;
      if (char === ")" && --depth === 0) break;
    }
    const body = sql.slice(start + 1, end);
    const name = match[1];
    if (!tables.has(name)) tables.set(name, { name, body, source: file });
  }
}

function splitDefinitions(body) {
  const output = [];
  let depth = 0, quote = false, start = 0;
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char === "'" && body[i - 1] !== "\\") quote = !quote;
    if (quote) continue;
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      output.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (body.slice(start).trim()) output.push(body.slice(start).trim());
  return output;
}

function convertDefinition(definition, table) {
  const line = definition.replace(/public\./gi, "").replace(/auth\.users\s*\(id\)/gi, "app_users(id)");
  const tableForeign = line.match(/^(?:constraint\s+([a-z_]+)\s+)?foreign key\s*\(([^)]+)\)\s*references\s+([a-z_]+)\s*\(([^)]+)\)(?:\s+on\s+delete\s+(restrict|cascade|set\s+null))?/i);
  if (tableForeign) {
    const constraint = tableForeign[1] ? `CONSTRAINT \`${tableForeign[1]}\` ` : "";
    const locals = tableForeign[2].split(",").map((name) => `\`${name.trim()}\``).join(", ");
    const targets = tableForeign[4].split(",").map((name) => `\`${name.trim()}\``).join(", ");
    const action = tableForeign[5] ? ` ON DELETE ${tableForeign[5].toUpperCase()}` : "";
    return { converted: `${constraint}FOREIGN KEY (${locals}) REFERENCES \`${tableForeign[3]}\` (${targets})${action}`, foreign: [] };
  }
  const column = line.match(/^([a-z_]+)\s+/i)?.[1];
  const reference = line.match(/\breferences\s+([a-z_]+)\s*\(([^)]+)\)(?:\s+on\s+delete\s+(restrict|cascade|set\s+null))?/i);
  const foreign = [];
  let converted = line.replace(/\breferences\s+[a-z_]+\s*\([^)]+\)(?:\s+on\s+delete\s+(?:restrict|cascade|set\s+null))?/i, "");
  converted = converted
    .replace(/\buuid\b/gi, "CHAR(36)")
    .replace(/\btimestamptz\b/gi, "DATETIME(3)")
    .replace(/\bbytea\b/gi, "BINARY(32)")
    .replace(/\bjsonb\b/gi, "JSON")
    .replace(/\btext\b/gi, /^(?:code|employee_code|email|event_id|idempotency_key|source_checksum|receipt_key|table_name|record_id|kind|role|status|operation|notification_type|batch_type|category_code|source_reference|timezone|token_hash|product_code_snapshot|department_code|eligibility_status|pos_promotion_status|pos_restore_status|line_type)$/i.test(column ?? "") ? "VARCHAR(191)" : "TEXT")
    .replace(/\b(?:app_role|store_status|sales_day_status|correction_status|campaign_status|import_status)\b/gi, "VARCHAR(40)")
    .replace(/\bbigint\s+generated\s+always\s+as\s+identity\b/gi, "BIGINT AUTO_INCREMENT")
    .replace(/\bunique\s+nulls\s+not\s+distinct\b/gi, "UNIQUE")
    .replace(/\bnow\(\)/gi, "CURRENT_TIMESTAMP(3)")
    .replace(/\bboolean\b/gi, "TINYINT(1)")
    .replace(/\bpublic\./gi, "")
    .replace(/::jsonb?/gi, "")
    .replace(/\bconstraint\s+([a-z_]+)\s+/gi, "CONSTRAINT `$1` ")
    .replace(/\bprimary key\b/gi, "PRIMARY KEY")
    .replace(/\bunique\s*\(/gi, "UNIQUE (")
    .replace(/\bdefault\s+true\b/gi, "DEFAULT 1")
    .replace(/\bdefault\s+false\b/gi, "DEFAULT 0")
    .replace(/\bdefault\s+gen_random_uuid\(\)/gi, "")
    .replace(/\bdefault\s+'(\{\}|\[\])'(?=\s*(?:,|$))/gi, "DEFAULT ('$1')")
    .replace(/\bon delete\s+(restrict|cascade|set\s+null)/gi, "ON DELETE $1");
  if (reference && column && table.name !== "app_users") {
    const action = reference[3] ? ` ON DELETE ${reference[3].toUpperCase()}` : "";
    foreign.push(`FOREIGN KEY (\`${column}\`) REFERENCES \`${reference[1]}\` (\`${reference[2].trim()}\`)${action}`);
  }
  return { converted, foreign };
}

const convert = (table) => {
  const fields = [];
  const foreign = [];
  let definitions = splitDefinitions(table.body);
  if (table.name === "store_sales_imports") {
    definitions = definitions.filter((definition) => !/^unique\s*\(import_id,\s*store_id\)$/i.test(definition));
    definitions.push("UNIQUE (import_id, store_id, business_date)");
  }
  for (const definition of definitions) {
    const result = convertDefinition(definition, table);
    if (result.converted) fields.push(result.converted);
    foreign.push(...result.foreign);
  }
  if (table.name === "app_users") fields.push("email VARCHAR(254) UNIQUE", "employee_code VARCHAR(100) UNIQUE", "affiliation VARCHAR(191)", "must_change_password TINYINT(1) NOT NULL DEFAULT 0");
  if (table.name === "stores") fields.push("opening_time TIME NOT NULL DEFAULT '09:00'");
  if (table.name === "products") fields.push("promotion_eligibility VARCHAR(32) NOT NULL DEFAULT 'not_configured'");
  if (table.name === "campaigns") fields.push("published_at DATETIME(3)");
  if (table.name === "campaign_store_targets") fields.push("store_confirmed_at DATETIME(3)", "store_confirmed_by CHAR(36)");
  if (table.name === "sales_lines") fields.push("receipt_key VARCHAR(191)", "receipt_customer_count INT NOT NULL DEFAULT 0");
  if (table.name === "notifications") fields.push("correction_id CHAR(36)");
  if (table.name === "sales_corrections") fields.push("pending_sales_day_id CHAR(36) GENERATED ALWAYS AS (CASE WHEN status IN ('pending_area_approval','pending_operations_approval') THEN sales_day_id ELSE NULL END) STORED", "UNIQUE (pending_sales_day_id)");
  if (table.name === "app_users") fields.push("password_hash VARCHAR(128) NOT NULL DEFAULT ''");
  if (table.name === "user_role_assignments") fields.push(
    "area_scope_key CHAR(36) GENERATED ALWAYS AS (IFNULL(area_id, '00000000-0000-0000-0000-000000000000')) STORED",
    "store_scope_key CHAR(36) GENERATED ALWAYS AS (IFNULL(store_id, '00000000-0000-0000-0000-000000000000')) STORED",
    "department_scope_key CHAR(36) GENERATED ALWAYS AS (IFNULL(department_id, '00000000-0000-0000-0000-000000000000')) STORED",
    "UNIQUE (user_id, role, area_scope_key, store_scope_key, department_scope_key)",
  );
  if (table.name === "campaign_store_targets") fields.push("FOREIGN KEY (`store_confirmed_by`) REFERENCES `app_users` (`id`) ON DELETE SET NULL");
  if (table.name === "notifications") fields.push("FOREIGN KEY (`correction_id`) REFERENCES `sales_corrections` (`id`) ON DELETE SET NULL");
  fields.push(...foreign);
  return `CREATE TABLE IF NOT EXISTS \`${table.name}\` (\n  ${fields.join(",\n  ")}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`;
};

const output = [
  "-- MySQL 8.4 InnoDB schema for the application data contract.",
  "-- This contains tables only; command transactions are implemented in TypeScript.",
  "SET NAMES utf8mb4;",
  ...[...tables.values()].map(convert),
  ...indexes.filter(({ name }) => name !== "one_pending_correction_per_sales_day").map(({ unique, name, table, columns }) => `CREATE ${unique ? "UNIQUE " : ""}INDEX \`${name}\` ON \`${table}\` (${columns.split(",").map((column) => `\`${column.trim()}\``).join(", ")});`),
  "CREATE TABLE IF NOT EXISTS `integration_receipts` (`event_id` VARCHAR(191) PRIMARY KEY, `content_hash` BINARY(32) NOT NULL, `kind` VARCHAR(40) NOT NULL, `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;",
  "CREATE TABLE IF NOT EXISTS `app_credentials` (`user_id` CHAR(36) PRIMARY KEY, `password_hash` VARCHAR(128) NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), CONSTRAINT `fk_credentials_user` FOREIGN KEY (`user_id`) REFERENCES `app_users` (`id`) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;",
].join("\n\n");
await writeFile(resolve(outputDir, "001_schema.sql"), `${output}\n`, "utf8");
console.log(`Wrote ${tables.size} MySQL tables to database/mysql/migrations/001_schema.sql`);
