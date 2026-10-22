import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { validateMigrationTarget } from "./migration-policy.mjs";

// Development fixtures only. Persist local codes before DB insert so interrupted runs recover.
async function run() {
  const env = process.env;
  validateMigrationTarget(env, readFileSync("supabase/.temp/project-ref", "utf8"));
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("サーバー専用キーが未設定です。");
  const path = ".env.demo-devices.local";
  const state = existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};
  if (state.PROJECT_REF && state.PROJECT_REF !== env.DEV_SUPABASE_PROJECT_REF)
    throw new Error("保存済み端末コードのProject IDが異なります。");
  state.PROJECT_REF = env.DEV_SUPABASE_PROJECT_REF;
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: stores, error } = await client
    .from("stores")
    .select("id,code")
    .in("code", ["DEMO-001", "DEMO-002", "DEMO-003"])
    .order("code");
  if (error || stores?.length !== 3)
    throw new Error("デモ3店舗が見つかりません。先に db:demo を実行してください。");
  for (const store of stores) {
    const key = `DEVICE_${store.code.replaceAll("-", "_")}_TOKEN`;
    const hash = createHash("sha256").update(`minoriya-demo-device-v1:${store.id}`).digest("hex");
    const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    const existing = await client
      .from("store_devices")
      .select("id,store_id,active,token_hash")
      .eq("id", id)
      .maybeSingle();
    if (existing.error) throw new Error("端末情報を取得できません。");
    if (!state[key]) {
      if (existing.data)
        throw new Error(
          "既存端末のコードファイルがありません。管理画面で端末を再発行してください。",
        );
      state[key] = randomBytes(32).toString("hex");
    }
    if (!/^[a-f0-9]{64}$/.test(state[key])) throw new Error("保存済みコードの形式が不正です。");
    const digest = "\\x" + createHash("sha256").update(state[key]).digest("hex");
    if (
      existing.data &&
      (!existing.data.active ||
        existing.data.store_id !== store.id ||
        existing.data.token_hash !== digest)
    ) {
      throw new Error("端末は失効済み、または保存コードと不一致です。自動で再有効化しません。");
    }
    writeFileSync(
      path,
      "# Local development station codes. Git ignored.\n" +
        Object.entries(state)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n") +
        "\n",
      { mode: 0o600 },
    );
    if (!existing.data) {
      const result = await client.from("store_devices").insert({
        id,
        store_id: store.id,
        name: `モック閲覧端末・${store.code}`,
        token_hash: digest,
      });
      if (result.error) throw new Error("モック端末を保存できません。再実行で続行できます。");
    }
    const anonymous = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const snapshot = await anonymous.rpc("store_device_snapshot", {
      p_token: state[key],
    });
    if (snapshot.error || snapshot.data?.store?.id !== store.id)
      throw new Error("端末コードの店舗照合に失敗しました。");
  }
  console.log(
    JSON.stringify({
      ok: true,
      devices: stores.length,
      verified: stores.length,
      credentialsFile: path,
    }),
  );
}
run().catch((error) => {
  console.error(error instanceof Error ? error.message : "端末セットアップに失敗しました。");
  process.exitCode = 1;
});
