"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CampaignActionState = {
  error?: string;
  success?: string;
};

type CampaignItemInput = {
  product_id: string;
  price_yen: number;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function requireSignedInUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    throw new Error("Unable to validate the current Supabase session.", { cause: error });
  }
  if (!user) {
    throw new Error("Authentication is required for campaign operations.");
  }
  return { supabase, userId: user.id };
}

async function requireProductOffice() {
  const { supabase, userId } = await requireSignedInUser();
  const { data: profile, error: profileError } = await supabase
    .from("app_users")
    .select("active")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) {
    throw new Error("Unable to validate the campaign editor profile.", { cause: profileError });
  }
  if (!profile?.active) {
    throw new Error("An active user profile is required to manage campaigns.");
  }

  const { data: role, error: roleError } = await supabase
    .from("user_role_assignments")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "product_office")
    .limit(1)
    .maybeSingle();
  if (roleError) {
    throw new Error("Unable to validate campaign editing permissions.", { cause: roleError });
  }
  if (!role) {
    throw new Error("Product office permissions are required to manage campaigns.");
  }
  return supabase;
}

function parseCampaignItems(raw: FormDataEntryValue | null): CampaignItemInput[] | null {
  if (typeof raw !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length < 1) return null;

  const items: CampaignItemInput[] = [];
  for (const value of parsed) {
    if (
      !isRecord(value)
      || typeof value.productId !== "string"
      || !uuidPattern.test(value.productId)
      || typeof value.priceYen !== "number"
      || !Number.isSafeInteger(value.priceYen)
      || value.priceYen < 0
      || value.priceYen > 2_147_483_647
    ) {
      return null;
    }
    items.push({ product_id: value.productId, price_yen: value.priceYen });
  }
  if (new Set(items.map((item) => item.product_id)).size !== items.length) return null;
  return items;
}

function parseJapanDateTime(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+09:00`);
  if (Number.isNaN(date.getTime())) return null;
  const japanDateTime = new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
  return japanDateTime === value ? date.toISOString() : null;
}

export async function createCampaignDraftAction(
  _previousState: CampaignActionState,
  formData: FormData,
): Promise<CampaignActionState> {
  const items = parseCampaignItems(formData.get("items"));
  const storeIds = formData.getAll("storeIds");
  const name = formData.get("name");
  const startsAt = parseJapanDateTime(formData.get("startsAt"));
  const endsAt = parseJapanDateTime(formData.get("endsAt"));

  if (
    typeof name !== "string"
    || name.trim().length < 1
    || !items
    || !startsAt
    || !endsAt
    || new Date(endsAt) <= new Date(startsAt)
    || storeIds.length < 1
    || storeIds.length > 112
    || storeIds.some((storeId) => typeof storeId !== "string" || !uuidPattern.test(storeId))
    || new Set(storeIds).size !== storeIds.length
  ) {
    return { error: "特売名・商品・価格・対象店舗・期間を確認してください。" };
  }

  const validatedStoreIds = storeIds.filter((storeId): storeId is string => typeof storeId === "string");
  const supabase = await requireProductOffice();
  const { error } = await supabase.rpc("create_campaign_draft", {
    p_name: name.trim(),
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_items: items,
    p_store_ids: validatedStoreIds,
  });
  if (error) {
    console.error("Campaign draft creation failed.", { code: error.code, message: error.message });
    return { error: "下書きを保存できませんでした。商品・店舗の状態と入力内容を確認してください。" };
  }

  revalidatePath("/campaigns");
  return { success: "特売の下書きを保存しました。" };
}

export async function publishCampaignDraftAction(
  _previousState: CampaignActionState,
  formData: FormData,
): Promise<CampaignActionState> {
  const campaignId = formData.get("campaignId");
  if (typeof campaignId !== "string" || !uuidPattern.test(campaignId)) {
    return { error: "特売を識別できません。画面を更新してください。" };
  }

  const supabase = await requireProductOffice();
  const { error } = await supabase.rpc("publish_campaign_draft", {
    p_campaign_id: campaignId,
  });
  if (error) {
    console.error("Campaign publication failed.", { code: error.code, message: error.message });
    return { error: "公開できませんでした。下書き状態と対象内容を確認してください。" };
  }

  revalidatePath("/campaigns");
  return { success: "対象店舗へ公開しました。POS価格の配信はIF接続後に有効になります。" };
}

export async function updateCampaignProgressAction(
  _previousState: CampaignActionState,
  formData: FormData,
): Promise<CampaignActionState> {
  const campaignItemId = formData.get("campaignItemId");
  const storeId = formData.get("storeId");
  const task = formData.get("task");
  const completedValue = formData.get("completed");
  if (
    typeof campaignItemId !== "string"
    || !uuidPattern.test(campaignItemId)
    || typeof storeId !== "string"
    || !uuidPattern.test(storeId)
    || typeof task !== "string"
    || !["confirmed", "price_label_changed", "pop_changed", "display_changed",
      "price_label_restored", "pop_restored", "display_restored"].includes(task)
    || (completedValue !== "true" && completedValue !== "false")
  ) {
    return { error: "作業内容を確認して、もう一度お試しください。" };
  }

  const { supabase } = await requireSignedInUser();
  const completed = completedValue === "true";
  const result = task === "confirmed"
    ? await supabase.rpc("set_campaign_store_confirmation", {
      p_campaign_item_id: campaignItemId,
      p_store_id: storeId,
      p_confirmed: completed,
    })
    : await supabase.rpc("set_campaign_item_store_task", {
      p_campaign_item_id: campaignItemId,
      p_store_id: storeId,
      p_task: task,
      p_completed: completed,
    });
  if (result.error) {
    console.error("Campaign progress update failed.", {
      code: result.error.code,
      message: result.error.message,
    });
    return { error: "状態を更新できませんでした。店舗権限と特売の状態を確認してください。" };
  }

  revalidatePath("/campaigns");
  return { success: completed ? "完了として記録しました。" : "未完了に戻しました。" };
}
