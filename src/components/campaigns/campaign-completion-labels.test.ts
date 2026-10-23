import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/actions/instructions", () => ({
  sendInstruction: vi.fn(),
  confirmInstruction: vi.fn(),
}));
vi.mock("@/server/actions/campaigns", () => ({
  createCampaignDraftAction: vi.fn(),
  publishCampaignDraftAction: vi.fn(),
  updateCampaignProgressAction: vi.fn(),
}));

import { ProgressAction } from "@/components/campaigns/campaign-management";
import { InstructionConfirmation } from "@/components/campaigns/instruction-form";

describe("特売価格の対応完了ボタン", () => {
  it("指示確認と店舗作業の未完了操作を対応完了に統一する", () => {
    const instruction = renderToStaticMarkup(
      createElement(InstructionConfirmation, {
        instructionId: "instruction-1",
        storeId: "store-1",
      }),
    );
    const campaign = renderToStaticMarkup(
      createElement(ProgressAction, {
        campaignItemId: "campaign-item-1",
        storeId: "store-1",
        task: "price_label_changed",
        completed: false,
      }),
    );

    expect(instruction).toContain("対応完了");
    expect(instruction).not.toContain("指示内容を確認しました");
    expect(campaign).toContain("対応完了");
    expect(campaign).not.toContain("完了登録");
  });
});
