import "server-only";
import { cache } from "react";
import { identity } from "@/server/container";

export const activeSession = cache(async () => {
  const session = await identity().session();
  if (!session?.active || !session.roles.length)
    throw new Error("個人ログインと利用権限が必要です。");
  if (session.mustChangePassword)
    throw new Error("初回パスワードを変更してください。");
  return session;
});

export async function requireRoles(roles: readonly string[]) {
  const session = await activeSession();
  if (!roles.some((role) => session.roles.includes(role)))
    throw new Error("この操作を実行する権限がありません。");
  return session;
}
