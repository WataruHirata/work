"use server";

import { redirect } from "next/navigation";
import { backendConfigured, identity } from "@/server/container";
import { safeAdminReturnPath } from "@/domain/access-policy";
import type { ActionResult } from "@/domain/contracts";

export async function signIn(data: FormData): Promise<ActionResult & { next?: string }> {
  try {
    if (!backendConfigured()) throw new Error("認証サービスの接続設定がありません。");
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!email || !password || email.length > 254 || password.length > 1024)
      throw new Error("メールアドレスとパスワードを入力してください。");
    const provider = identity();
    await provider.signIn(email, password);
    const session = await provider.session();
    return {
      next: session?.mustChangePassword
        ? "/account/password"
        : safeAdminReturnPath(String(data.get("next") ?? "")),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "ログインできませんでした。",
    };
  }
}

export async function changePassword(
  _previous: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    const provider = identity();
    const session = await provider.session();
    if (!session?.active) throw new Error("再度ログインしてください。");
    const password = String(data.get("password") ?? "");
    if (password.length < 12 || password.length > 128 || password !== data.get("confirmation"))
      throw new Error("12～128文字の同じパスワードを2回入力してください。");
    await provider.changePassword(password);
    return {
      success: "パスワードを変更しました。店舗ポータルまたは管理メニューへ移動できます。",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "変更できませんでした。",
    };
  }
}

export async function resetPassword(
  _previous: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    const origin = process.env.APP_ORIGIN;
    if (!origin || !/^https?:\/\//.test(origin))
      throw new Error("パスワード再設定用の接続設定がありません。");
    const email = String(data.get("email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("メールアドレスを入力してください。");
    await identity().resetPassword(
      email,
      new URL("/auth/callback?next=/account/password", origin).toString(),
    );
    return {
      success: "登録されている場合、再設定メールを送信します。メールをご確認ください。",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "受け付けられませんでした。",
    };
  }
}

export async function logout() {
  if (backendConfigured()) await identity().signOut();
  redirect("/");
}
