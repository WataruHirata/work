import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("MySQL schema contract", () => {
  it("declares the application tables in InnoDB without PostgreSQL-only objects", async () => {
    const schema = await readFile("database/mysql/migrations/001_schema.sql", "utf8");
    const tables = [...schema.matchAll(/CREATE TABLE IF NOT EXISTS `([a-z_]+)`/g)].map(
      (match) => match[1],
    );
    expect(tables).toHaveLength(32);
    expect(tables).toContain("app_users");
    expect(tables).toContain("sales_corrections");
    expect(tables).toContain("integration_jobs");
    expect(tables).toContain("store_instructions");
    expect(schema).toContain("ENGINE=InnoDB");
    expect(schema).not.toMatch(
      /\b(public\.|auth\.|jsonb|timestamptz|plpgsql|row level security)\b/i,
    );
  });

  it("preserves nullable-scope role uniqueness in MySQL", async () => {
    const schema = await readFile("database/mysql/migrations/001_schema.sql", "utf8");
    expect(schema).toContain(
      "UNIQUE (user_id, role, area_scope_key, store_scope_key, department_scope_key)",
    );
    expect(schema).toContain("pending_sales_day_id");
  });

  it("adds auditable product-office approval to completed campaign work", async () => {
    const migration = await readFile(
      "database/mysql/migrations/002_campaign_work_approval.sql",
      "utf8",
    );
    expect(migration).toContain("work_approved_at");
    expect(migration).toContain("work_approved_by");
    expect(migration).toContain("FOREIGN KEY (`work_approved_by`)");
  });
});
