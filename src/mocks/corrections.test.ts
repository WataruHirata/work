import { describe, expect, it } from "vitest";
import { decideCorrection, initialCorrections } from "@/mocks/corrections";

describe("売上修正の申請・通知プレビュー（AT-04/05/10）", () => {
  it("本部最終承認を一次承認前に行えず、二段階で完了する", () => {
    expect(() =>
      decideCorrection(initialCorrections, "DEMO-C001", "operations", true, ""),
    ).toThrow();
    const first = decideCorrection(initialCorrections, "DEMO-C001", "area", true, "確認済み");
    expect(first[0].status).toBe("pending_operations");
    const final = decideCorrection(first, "DEMO-C001", "operations", true, "確認済み");
    expect(final[0].status).toBe("approved");
    expect(() => decideCorrection(final, "DEMO-C001", "operations", true, "")).toThrow();
    expect(initialCorrections[0].status).toBe("pending_area");
  });
  it("差戻しには理由が必要で、変更前金額を維持する", () => {
    expect(() => decideCorrection(initialCorrections, "DEMO-C001", "area", false, " ")).toThrow();
    const result = decideCorrection(
      initialCorrections,
      "DEMO-C001",
      "area",
      false,
      "伝票を再確認してください",
    );
    expect(result[0].status).toBe("rejected");
    expect(result[0].comment).toBe("伝票を再確認してください");
    expect(result[0].before).toBe(900000);
  });
});
