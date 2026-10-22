// AT-10/12: only the explicitly selected development project may be migrated.
export function migrationEnabled(env, automatic) {
  return !automatic || env.AUTO_MIGRATE === "true";
}

export function validateMigrationTarget(env, linkedRef) {
  if (env.VERCEL_ENV === "production" || env.NODE_ENV === "production" || env.CI) {
    throw new Error(
      "このコマンドは開発専用です。本番は保護されたCIのマイグレーションを使用してください。",
    );
  }
  const expected = env.DEV_SUPABASE_PROJECT_REF;
  if (!/^[a-z]{20}$/.test(expected ?? ""))
    throw new Error("DEV_SUPABASE_PROJECT_REF に開発用の20文字のProject IDを設定してください。");
  let url;
  try {
    url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  } catch {
    throw new Error("Supabase URLが未設定または不正です。");
  }
  if (url.origin !== `https://${expected}.supabase.co` || linkedRef.trim() !== expected) {
    throw new Error(
      "アプリURL・リンク先・開発用Project IDが一致しません。対象を確認して supabase link を実行してください。",
    );
  }
  return expected;
}
