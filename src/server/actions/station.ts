"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repository } from "@/server/container";
import { stationCookie } from "@/server/auth/store-context";
import type { ActionResult } from "@/domain/contracts";

export async function connectStation(
  _previous: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    const token = String(data.get("token") ?? "")
      .trim()
      .toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new Error("管理者が発行した64文字の接続コードを入力してください。");
    await repository().storeSnapshot(token);
    (await cookies()).set(stationCookie, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });
    revalidatePath("/", "layout");
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "接続できませんでした。",
    };
  }
  redirect("/");
}
export async function disconnectStation() {
  (await cookies()).delete(stationCookie);
  revalidatePath("/", "layout");
}
