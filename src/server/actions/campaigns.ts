"use server";

import { revalidatePath } from "next/cache";
import { repository } from "@/server/container";
import { activeSession, requireRoles } from "@/server/auth/session";
import { text, uuid, integer } from "@/server/validation";

export type CampaignActionState = { error?: string; success?: string };
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "特売処理を保存できませんでした。";
}
function refresh() {
  revalidatePath("/admin/campaigns");
  revalidatePath("/store/campaigns");
}
function japanTime(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw))
    throw new Error("開始・終了日時を指定してください。");
  const value = new Date(raw + ":00+09:00");
  if (
    Number.isNaN(value.getTime()) ||
    new Date(value.getTime() + 9 * 3600000).toISOString().slice(0, 16) !== raw
  )
    throw new Error("日時が不正です。");
  return value.toISOString();
}
export async function createCampaignDraftAction(
  _previous: CampaignActionState,
  data: FormData,
): Promise<CampaignActionState> {
  try {
    await requireRoles(["product_office"]);
    const raw: unknown = JSON.parse(String(data.get("items")));
    if (!Array.isArray(raw) || !raw.length) throw new Error("特売商品を指定してください。");
    const items = raw.map((line: { productId?: unknown; priceYen?: unknown }) => ({
      product_id: uuid(line?.productId),
      price_yen: integer(line?.priceYen, 0, 2147483647),
    }));
    if (new Set(items.map((item) => item.product_id)).size !== items.length)
      throw new Error("同じ商品を重複して指定できません。");
    const stores = data.getAll("storeIds").map(uuid);
    if (stores.length < 1 || stores.length > 112 || new Set(stores).size !== stores.length)
      throw new Error("対象店舗を確認してください。");
    const starts = japanTime(data.get("startsAt")),
      ends = japanTime(data.get("endsAt"));
    if (ends <= starts) throw new Error("終了日時は開始日時より後にしてください。");
    await repository().execute("createCampaign", {
      p_name: text(data.get("name"), 200),
      p_starts_at: starts,
      p_ends_at: ends,
      p_items: items,
      p_store_ids: stores,
    });
    refresh();
    return {
      success: "特売の下書きを保存しました。既存マスタの対象区分を確認して公開してください。",
    };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
export async function publishCampaignDraftAction(
  _previous: CampaignActionState,
  data: FormData,
): Promise<CampaignActionState> {
  try {
    await requireRoles(["product_office"]);
    await repository().execute("publishCampaign", {
      p_campaign_id: uuid(data.get("campaignId")),
    });
    refresh();
    return {
      success: "対象店舗へ公開しました。POS連携の結果は店舗別状況で確認できます。",
    };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
export async function updateCampaignProgressAction(
  _previous: CampaignActionState,
  data: FormData,
): Promise<CampaignActionState> {
  try {
    await activeSession();
    const task = String(data.get("task"));
    const completed = data.get("completed");
    if (
      ![
        "confirmed",
        "price_label_changed",
        "pop_changed",
        "display_changed",
        "price_label_restored",
        "pop_restored",
        "display_restored",
      ].includes(task) ||
      (completed !== "true" && completed !== "false")
    )
      throw new Error("作業内容を確認してください。");
    const input = {
      p_campaign_item_id: uuid(data.get("campaignItemId")),
      p_store_id: uuid(data.get("storeId")),
    };
    await repository().execute(
      task === "confirmed" ? "confirmCampaign" : "updateCampaignTask",
      task === "confirmed"
        ? { ...input, p_confirmed: completed === "true" }
        : { ...input, p_task: task, p_completed: completed === "true" },
    );
    refresh();
    return { success: "店舗作業の状態を保存しました。" };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
