import { createHash } from "node:crypto";

const supabase = process.env.DATABASE_PROVIDER === "supabase";
const origin = process.env.APP_ORIGIN ?? (supabase ? undefined : "http://localhost:3000");
const secret =
  process.env.CRON_SECRET ??
  (supabase
    ? undefined
    : createHash("sha256").update("minoriya local mock cron token only").digest("hex"));
if (!origin || !secret)
  throw new Error("APP_ORIGIN and CRON_SECRET must be configured for Supabase.");
const response = await fetch(new URL("/api/integrations/run", origin), {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
  redirect: "error",
  signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error(`連携処理を実行できませんでした（HTTP ${response.status}）。`);
const result = await response.json();
console.log(
  JSON.stringify({
    claimed: result.claimed,
    completed: result.completed,
    failed: result.failed,
    unconfigured: result.unconfigured,
  }),
);
