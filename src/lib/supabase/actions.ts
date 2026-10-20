"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function submitApprovalDecision(input: {
  correctionId: string;
  approved: boolean;
  comment?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("認証済みユーザーが見つかりません");
  }

  const { error } = await supabase.rpc("approve_sales_correction", {
    p_correction_id: input.correctionId,
    p_approved: input.approved,
    p_comment: input.comment ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/approvals");
  return { ok: true };
}

export async function createSalesCorrection(input: {
  salesDayId: string;
  reason: string;
  afterAmountYen: number;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("認証済みユーザーが見つかりません");
  }

  const { data, error } = await supabase.rpc("request_sales_correction", {
    p_sales_day_id: input.salesDayId,
    p_reason: input.reason,
    p_after_amount_yen: input.afterAmountYen,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/sales");
  return { correctionId: data };
}

export async function uploadCsvImport(formData: FormData) {
  const file = formData.get("csvFile");
  if (!(file instanceof File) || !file.name.endsWith(".csv")) {
    throw new Error("CSVファイルを選択してください");
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    throw new Error("Supabase admin client is not configured");
  }

  const csv = await file.text();
  const rows = csv
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(1)
    .map((line) => {
      const values = line.split(",");
      return {
        source_file_name: file.name,
        source_checksum: `${file.name}-${values.length}`,
        rows_received: values.length,
      };
    });

  if (rows.length === 0) {
    throw new Error("読み取れるCSVレコードがありません");
  }

  const { error } = await adminClient.from("sales_imports").insert([
    {
      source_file_name: file.name,
      source_checksum: `${file.name}-${Date.now()}`,
      status: "received",
      rows_received: rows.length,
    },
  ]);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/imports");
  return { ok: true, rows: rows.length };
}
