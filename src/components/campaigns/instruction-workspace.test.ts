import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ records: vi.fn() }));
vi.mock("@/server/queries/workspaces", () => ({ allRecords: mocks.records }));
vi.mock("@/components/campaigns/campaign-management", () => ({
  ProgressAction: ({ task, completed }: { task: string; completed: boolean }) =>
    createElement("button", { "data-task": task, "data-completed": completed }, "完了登録"),
}));
vi.mock("@/components/campaigns/instruction-form", () => ({
  InstructionForm: () => null,
  InstructionConfirmation: () => null,
}));

import { InstructionWorkspace } from "@/components/campaigns/instruction-workspace";

describe("店舗お知らせの特売タスク FR-020/029 AT-07/10", () => {
  it("POSと商品値札を商品・期間・価格とともに個別完了できる", async () => {
    mocks.records.mockImplementation(async (resource: string) => {
      const rows: Record<string, unknown[]> = {
        instructions: [],
        instructionTargets: [],
        stores: [{ id: "store-1", name: "架空中央店" }],
        products: [{ id: "product-1", code: "P001", name: "架空りんご" }],
        campaigns: [
          {
            id: "campaign-1",
            name: "架空青果特売",
            starts_at: "2026-11-01T00:00:00Z",
            ends_at: "2026-11-03T00:00:00Z",
            status: "scheduled",
          },
        ],
        campaignItems: [
          {
            id: "item-1",
            campaign_id: "campaign-1",
            product_id: "product-1",
            price_yen: 123,
          },
        ],
        campaignTargets: [{ id: "target-1", campaign_id: "campaign-1", store_id: "store-1" }],
        campaignTasks: [
          {
            id: "task-1",
            campaign_item_id: "item-1",
            store_id: "store-1",
            pos_promotion_status: "not_configured",
            price_label_changed_at: null,
          },
        ],
      };
      return rows[resource] ?? [];
    });
    const html = renderToStaticMarkup(
      await InstructionWorkspace({ storeId: "store-1", canRecordStoreWork: true }),
    );
    expect(html).toContain("POS・商品値札の変更依頼");
    expect(html).toContain("架空りんご");
    expect(html).toContain("123");
    expect(html).toContain('data-task="pos_changed"');
    expect(html).toContain('data-task="price_label_changed"');
    expect(html.match(/未処理/g)).toHaveLength(2);
  });
});
