// Supply secrets through the environment; never pass them on the command line.
if (!process.env.APP_ORIGIN || !process.env.CRON_SECRET) throw new Error("APP_ORIGINとCRON_SECRETを設定してください。");
const response = await fetch(new URL("/api/integrations/run", process.env.APP_ORIGIN), { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, redirect: "error", signal: AbortSignal.timeout(60000) });
if (!response.ok) throw new Error(`連携処理を実行できませんでした（HTTP ${response.status}）。`);
const result = await response.json();
console.log(JSON.stringify({ claimed: result.claimed, completed: result.completed, failed: result.failed, unconfigured: result.unconfigured }));
