"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { repository } from "@/server/container";
import { requireRoles } from "@/server/auth/session";
import { canonicalSalesRows } from "@/server/imports/canonical-import";
import type { ActionResult } from "@/domain/contracts";
export async function importSalesCsv(
  _state: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  try {
    await requireRoles(["information_systems"]);
    const file = data.get("file");
    if (
      !(file instanceof File) ||
      !file.name.toLowerCase().endsWith(".csv") ||
      file.size > 5_000_000
    )
      throw new Error("5MB以内のCSVを選択してください。");
    const source = await file.text();
    const rows = canonicalSalesRows(source);
    const result = await repository().execute("importSales", {
      p_source_name: file.name.slice(0, 200),
      p_checksum: createHash("sha256").update(source).digest("hex"),
      p_rows: rows,
    });
    revalidatePath("/admin", "layout");
    revalidatePath("/store", "layout");
    const inserted =
      result && typeof result === "object" && !Array.isArray(result)
        ? result.inserted
        : 0;
    return {
      success: `取込が完了しました。新規明細 ${inserted}件。同じ内容の再送は二重計上しません。`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "取込できませんでした。",
    };
  }
}
