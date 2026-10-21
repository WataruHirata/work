import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  migrationEnabled,
  validateMigrationTarget,
} from "./migration-policy.mjs";

try {
  const automatic = process.argv.includes("--auto");
  if (!migrationEnabled(process.env, automatic)) {
    console.log(
      "自動マイグレーションは無効です（AUTO_MIGRATE=true で有効化）。",
    );
  } else {
    let linkedRef;
    try {
      linkedRef = readFileSync("supabase/.temp/project-ref", "utf8");
    } catch {
      throw new Error(
        "Supabaseが未リンクです。先に supabase link を実行してください。",
      );
    }
    validateMigrationTarget(process.env, linkedRef);
    // Command strings are constants. No credentials or user-supplied arguments are interpolated.
    const command = process.argv.includes("--dry-run")
      ? "npx --yes supabase@2.121.0 db push --linked --dry-run"
      : "npx --yes supabase@2.121.0 db push --linked --yes";
    const result = spawnSync(command, {
      shell: true,
      stdio: "inherit",
      env: process.env,
    });
    if (result.error || result.status !== 0)
      throw new Error(
        "マイグレーションに失敗しました。起動を中止します。CLI認証・接続・SQLを確認してください。",
      );
  }
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "マイグレーションを完了できませんでした。",
  );
  process.exitCode = 1;
}
