import { describe, expect, it } from "vitest";
import {
  confirmDemoInstruction,
  demoInstructions,
  filterPreviewRows,
  previewSpecs,
  targetInstructions,
} from "@/mocks/workspaces";
import { adminFeatures } from "@/domain/access-policy";
import { uiConfig } from "@/config/ui";

describe("未接続機能のプレビュー（AT-03/07/10 表示・操作基盤）", () => {
  it("全店舗・本部機能にテーブルまたは指示プレビューを用意する", () => {
    for (const feature of [...adminFeatures, ...uiConfig.navigation]) {
      if (["campaigns", "storeCampaigns", "storeNotices"].includes(feature)) continue;
      expect(previewSpecs[feature]?.rows.length).toBeGreaterThan(0);
    }
  });
  it("検索・店舗・状態を組み合わせて一覧と集計対象を絞る", () => {
    const rows = previewSpecs.sales!.rows;
    expect(filterPreviewRows(rows, "10/21", "デモ中央店", "締め前")).toHaveLength(1);
    expect(filterPreviewRows(rows, "存在しない", "", "")).toHaveLength(0);
    expect(filterPreviewRows(rows, "", "デモ南店", "").reduce((sum, r) => sum + r.value, 0)).toBe(
      840000,
    );
  });
  it("指示は指定店舗だけに表示し、店舗確認は対象内かつ重複なしで記録する", () => {
    expect(targetInstructions(demoInstructions, "デモ南店")).toHaveLength(0);
    expect(targetInstructions(demoInstructions, "デモ中央店")).toHaveLength(1);
    const wrong = confirmDemoInstruction(demoInstructions, "DEMO-N001", "デモ南店");
    expect(wrong[0].confirmedStores).toHaveLength(0);
    const correct = confirmDemoInstruction(demoInstructions, "DEMO-N001", "デモ中央店");
    expect(confirmDemoInstruction(correct, "DEMO-N001", "デモ中央店")[0].confirmedStores).toEqual([
      "デモ中央店",
    ]);
    expect(demoInstructions[0].confirmedStores).toHaveLength(0);
  });
});
