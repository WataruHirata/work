"use server";

import { revalidatePath } from "next/cache";
import { repository } from "@/server/container";
import { activeSession, requireRoles } from "@/server/auth/session";
import { integer, text, uuid } from "@/server/validation";
import type { ActionResult } from "@/domain/contracts";

export async function sendInstruction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    await requireRoles(["product_office"]);
    if (data.get("confirmed") !== "true") throw new Error("商品・価格・実施日時・対象店舗を確認してください。");
    const kind = text(data.get("kind"));
    if (!["promotion", "price_change"].includes(kind)) throw new Error("指示の種類を選択してください。");
    const rawDate = String(data.get("effectiveAt"));
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(rawDate) || !Number.isFinite(Date.parse(`${rawDate}:00+09:00`))) throw new Error("実施日時を指定してください。");
    const stores = data.getAll("storeIds").map(uuid);
    if (!stores.length || stores.length > 112 || new Set(stores).size !== stores.length) throw new Error("対象店舗を選択してください。");
    await repository().execute("sendInstruction", { p_request_id: uuid(data.get("requestId")), p_kind: kind, p_title: text(data.get("title"), 200), p_message: text(data.get("message"), 2000), p_product_id: uuid(data.get("productId")), p_price_yen: integer(data.get("priceYen")), p_effective_at: new Date(`${rawDate}:00+09:00`).toISOString(), p_store_ids: stores });
    revalidatePath("/admin/campaigns"); revalidatePath("/store", "layout");
    return { success: "指示を発行し、指定店舗のお知らせに通知しました。" };
  } catch (error) { return { error: error instanceof Error ? error.message : "指示を発行できませんでした。" }; }
}

export async function confirmInstruction(_state: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    await activeSession();
    await repository().execute("confirmInstruction", { p_instruction_id: uuid(data.get("instructionId")), p_store_id: uuid(data.get("storeId")) });
    revalidatePath("/store", "layout"); revalidatePath("/admin/campaigns");
    return { success: "店舗確認を記録しました。" };
  } catch (error) { return { error: error instanceof Error ? error.message : "確認を記録できませんでした。" }; }
}
