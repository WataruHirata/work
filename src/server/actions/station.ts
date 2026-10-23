"use server";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { repository } from "@/server/container";
import { stationCookie } from "@/server/auth/store-context";
import type { ActionResult } from "@/domain/contracts";

const demoStationToken = () => {
  if (process.env.DEMO_STATION_AUTO_CONNECT !== "true") return null;
  const configured = process.env.DEVICE_DEMO_001_TOKEN?.trim().toLowerCase();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production" || !existsSync(".env.demo-devices.local")) return null;
  return parseEnv(readFileSync(".env.demo-devices.local", "utf8"))
    .DEVICE_DEMO_001_TOKEN?.trim()
    .toLowerCase();
};

const snapshotStoreCode = (snapshot: Record<string, unknown>) => {
  const store = snapshot.store;
  if (!store || typeof store !== "object" || Array.isArray(store)) return null;
  const code = (store as Record<string, unknown>).code;
  return typeof code === "string" ? code : null;
};

export async function connectStation(
  _previous: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    const submittedToken = String(data.get("token") ?? "")
      .trim()
      .toLowerCase();
    const automatic = !submittedToken && process.env.DEMO_STATION_AUTO_CONNECT === "true";
    const token = submittedToken || demoStationToken() || "";
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new Error(
        automatic
          ? "デバイス1の接続設定を確認してください。"
          : "管理者が発行した64文字の接続コードを入力してください。",
      );
    const snapshot = await repository().storeSnapshot(token);
    if (automatic && snapshotStoreCode(snapshot) !== "DEMO-001")
      throw new Error("デバイス1の接続先がデモ店舗1と一致しません。");
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
