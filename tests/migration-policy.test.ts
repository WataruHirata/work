import { describe, expect, it } from "vitest";
import { migrationEnabled, validateMigrationTarget } from "../scripts/migration-policy.mjs";

describe("開発用マイグレーションの接続先制御 / AT-10/12", () => {
  const ref = "abcdefghijklmnopqrst";
  const env = {
    DEV_SUPABASE_PROJECT_REF: ref,
    NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  };
  it("自動適用は明示的に有効にした場合だけ実行する", () => {
    expect(migrationEnabled({}, true)).toBe(false);
    expect(migrationEnabled({ AUTO_MIGRATE: "true" }, true)).toBe(true);
    expect(migrationEnabled({}, false)).toBe(true);
  });
  it("URL・許可した開発先・リンク先の一致を必須とする", () => {
    expect(validateMigrationTarget(env, ref + "\n")).toBe(ref);
    expect(() => validateMigrationTarget(env, "bcdefghijklmnopqrstu")).toThrow();
    expect(() =>
      validateMigrationTarget({ ...env, NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid" }, ref),
    ).toThrow();
    expect(() =>
      validateMigrationTarget({ ...env, DEV_SUPABASE_PROJECT_REF: "short" }, ref),
    ).toThrow();
  });
  it("本番・CIでは開発用コマンドによる変更を拒否する", () => {
    for (const setting of [
      { VERCEL_ENV: "production" },
      { NODE_ENV: "production" },
      { CI: "true" },
    ]) {
      expect(() => validateMigrationTarget({ ...env, ...setting }, ref)).toThrow();
    }
  });
});
