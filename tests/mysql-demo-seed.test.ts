import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("MySQL rich demo fixtures", () => {
  it("keeps the fixture production guard and deterministic upserts", async () => {
    const seed = await readFile("scripts/setup-mysql-demo.mjs", "utf8");

    expect(seed).toContain('process.env.NODE_ENV === "production"');
    expect(seed).toContain("ON DUPLICATE KEY UPDATE");
    expect(seed).toContain("await db.beginTransaction()");
    expect(seed).toContain("await db.rollback()");
    expect(seed).toContain("@example.invalid");
  });

  it("documents the MySQL database and selects MySQL authentication explicitly", async () => {
    const envExample = await readFile(".env.example", "utf8");
    const container = await readFile("src/server/container.ts", "utf8");

    expect(envExample).toContain("DATABASE_PROVIDER=mysql");
    expect(envExample).toContain("MYSQL_DATABASE=minoriya_starter");
    expect(container).toContain('process.env.DATABASE_PROVIDER === "mysql"');
    expect(container).toMatch(/if \(isMysqlProvider\(\)\) return new MysqlIdentity\(\)/);
  });

  it("covers the UI status branches and verifies them from the database", async () => {
    const seed = await readFile("scripts/setup-mysql-demo.mjs", "utf8");
    const verifier = await readFile("scripts/verify-mysql-demo.mjs", "utf8");
    const requiredStates = [
      "pending_area_approval",
      "pending_operations_approval",
      "monthly_finalized",
      "not_configured",
      "manual_confirmed",
      "processing",
      "completed",
      "failed",
      "rejected",
      "cancelled",
    ];

    for (const state of requiredStates) {
      expect(seed).toContain(`"${state}"`);
      expect(verifier).toContain(`"${state}"`);
    }
    expect(verifier).toContain("read_at IS NULL");
    expect(verifier).toContain("read_at IS NOT NULL");
    expect(verifier).toContain('authUser.role !== "information_systems"');
  });
});
