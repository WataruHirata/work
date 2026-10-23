"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { backendConfigured, identity } from "@/server/container";
import {
  canUseAdminFeature,
  adminFeatures,
  isAdminRole,
  safeAdminReturnPath,
  type AdminFeature,
  type AdminRole,
} from "@/domain/access-policy";
import type { ActionResult } from "@/domain/contracts";
import { activeAdminRoleCookie } from "@/server/auth/admin-role";

export async function signIn(
  data: FormData,
): Promise<ActionResult & { next?: string; roles?: AdminRole[] }> {
  try {
    if (!backendConfigured()) throw new Error("認証サービスの接続設定がありません。");
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!email || !password || email.length > 254 || password.length > 1024)
      throw new Error("メールアドレスとパスワードを入力してください。");
    const provider = identity();
    await provider.signIn(email, password);
    const session = await provider.session();
    const roles = (session?.roles ?? []).filter(isAdminRole);
    if (session?.mustChangePassword) return { next: "/account/password" };
    if (roles.length) {
      (await cookies()).delete(activeAdminRoleCookie);
      return { roles };
    }
    return {
      next:
        session && session.roles.length === 0
          ? "/store/orders"
          : safeAdminReturnPath(String(data.get("next") ?? "")),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "ログインできませんでした。",
    };
  }
}

export async function selectAdminRole(
  roleValue: string,
  returnTo?: string,
): Promise<ActionResult & { next?: string }> {
  try {
    if (!isAdminRole(roleValue)) throw new Error("選択できない権限です。");
    const session = await identity().session();
    if (!session?.active || session.mustChangePassword || !session.roles.includes(roleValue))
      throw new Error("このアカウントに割り当てられていない権限は選択できません。");

    const cookieStore = await cookies();
    cookieStore.set(activeAdminRoleCookie, roleValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    const requestedPath = safeAdminReturnPath(returnTo);
    const feature = requestedPath.startsWith("/admin/")
      ? requestedPath.slice("/admin/".length)
      : undefined;
    return {
      next:
        feature &&
        adminFeatures.includes(feature as AdminFeature) &&
        canUseAdminFeature([roleValue], feature as AdminFeature)
          ? requestedPath
          : "/admin",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "権限を選択できませんでした。" };
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
  (await cookies()).delete(activeAdminRoleCookie);
  if (backendConfigured()) await identity().signOut();
  redirect("/");
}
