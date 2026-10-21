"use server";
import { revalidatePath } from "next/cache";
import { repository } from "@/server/container";
import { requireRoles } from "@/server/auth/session";
import { integer, text, uuid } from "@/server/validation";
import { requireAdminFeature } from "@/server/auth/admin-access";
import { importSalesCsv } from "@/server/actions/sales-import";
import { canonicalSalesRows } from "@/server/imports/canonical-import";

export async function submitApprovalDecision(input: {
  correctionId: string;
  approved: boolean;
  comment?: string;
}) {
  await requireRoles(["area_manager", "store_operations"]);
  if (typeof input.approved !== "boolean" || (input.comment?.length ?? 0) > 500)
    throw new Error("承認内容を確認してください。");
  await repository().execute("approveCorrection", {
    p_correction_id: uuid(input.correctionId),
    p_approved: input.approved,
    p_comment: input.comment ?? null,
  });
  revalidatePath("/admin/approvals");
  return { ok: true };
}
export async function createSalesCorrection(input: {
  salesDayId: string;
  reason: string;
  afterAmountYen: number;
}) {
  await requireRoles(["store_manager"]);
  const id = await repository().execute("requestCorrection", {
    p_sales_day_id: uuid(input.salesDayId),
    p_reason: text(input.reason),
    p_after_amount_yen: integer(input.afterAmountYen),
  });
  revalidatePath("/admin/sales");
  revalidatePath("/store/operations");
  return { correctionId: id };
}
export async function uploadCsvImport(formData: FormData) {
  const session = await requireAdminFeature("imports");
  if (session.status !== "authorized")
    throw new Error("認証済みの情報システム権限が必要です。");
  const file = formData.get("csvFile");
  if (!(file instanceof File))
    throw new Error("CSVファイルを選択してください。");
  const data = new FormData();
  data.set("file", file);
  const result = await importSalesCsv({}, data);
  if (result.error) throw new Error(result.error);
  return { ok: true, rows: canonicalSalesRows(await file.text()).length };
}
