export type CorrectionPreview = {
  id: string;
  store: string;
  date: string;
  before: number;
  after: number;
  reason: string;
  status: "pending_area" | "pending_operations" | "approved" | "rejected";
  comment: string;
};
export const correctionLabels = {
  pending_area: "エリア一次承認待ち",
  pending_operations: "本部最終承認待ち",
  approved: "承認済み・売上反映済み（デモ）",
  rejected: "差戻し",
};
export const initialCorrections: CorrectionPreview[] = [
  {
    id: "DEMO-C001",
    store: "デモ中央店",
    date: "2026-10-20",
    before: 900000,
    after: 902000,
    reason: "サンプル：計上漏れの訂正",
    status: "pending_area",
    comment: "",
  },
];
export function decideCorrection(
  rows: CorrectionPreview[],
  id: string,
  stage: "area" | "operations",
  approved: boolean,
  comment: string,
): CorrectionPreview[] {
  if (!approved && !comment.trim()) throw new Error("差戻し理由を入力してください。");
  return rows.map((row) => {
    if (row.id !== id) return row;
    if (
      (stage === "area" && row.status !== "pending_area") ||
      (stage === "operations" && row.status !== "pending_operations")
    )
      throw new Error("現在の承認段階では処理できません。");
    return {
      ...row,
      status: approved ? (stage === "area" ? "pending_operations" : "approved") : "rejected",
      comment: comment.trim(),
    };
  });
}
