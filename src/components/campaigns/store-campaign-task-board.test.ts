import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/state-badge", () => ({
  StateBadge: ({ label }: { label: string }) => createElement("span", null, label),
}));
vi.mock("@/components/campaigns/instruction-form", () => ({
  InstructionConfirmation: () =>
    createElement("button", { "data-testid": "instruction-complete" }, "対応完了"),
}));
vi.mock("@/components/campaigns/campaign-management", () => ({
  ProgressAction: () => createElement("button", { "data-testid": "campaign-complete" }, "対応完了"),
}));

import { StoreCampaignTaskBoard } from "@/components/campaigns/store-campaign-task-board";

describe("特売価格の店舗対応一覧 FR-020/029 AT-07/10", () => {
  it("未完了カードだけに対応完了を表示し、完了済みカードを対応済み列へ分ける", () => {
    const html = renderToStaticMarkup(
      createElement(StoreCampaignTaskBoard, {
        storeId: "store-1",
        instructions: [
          {
            id: "instruction-pending",
            kind: "price_change",
            title: "未対応の価格変更",
            product_id: "product-1",
            price_yen: 198,
            effective_at: "2026-10-24T00:00:00Z",
            message: "価格を変更してください。",
          },
          {
            id: "instruction-completed",
            kind: "promotion",
            title: "対応済みの特売",
            product_id: "product-1",
            price_yen: 178,
            effective_at: "2026-10-23T00:00:00Z",
            message: "値札を変更してください。",
          },
        ],
        instructionTargets: [
          {
            id: "target-pending",
            instruction_id: "instruction-pending",
            store_id: "store-1",
            confirmed_at: null,
          },
          {
            id: "target-completed",
            instruction_id: "instruction-completed",
            store_id: "store-1",
            confirmed_at: "2026-10-23T01:00:00Z",
          },
        ],
        products: [{ id: "product-1", code: "P001", name: "架空りんご" }],
        campaigns: [],
        campaignItems: [],
        campaignTargets: [],
        tasks: [],
      }),
    );
    const completedColumnStart = html.indexOf('aria-label="対応済み"');
    const pendingColumn = html.slice(0, completedColumnStart);
    const completedColumn = html.slice(completedColumnStart);

    expect(html).toContain('aria-label="要対応"');
    expect(pendingColumn).toContain("未対応の価格変更");
    expect(pendingColumn).toContain("対応完了");
    expect(pendingColumn).not.toContain("対応済みの特売");
    expect(completedColumn).toContain("対応済みの特売");
    expect(completedColumn).not.toContain('data-testid="instruction-complete"');
  });
});
