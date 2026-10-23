import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/page-layout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) =>
    createElement("main", null, children),
}));
vi.mock("@/components/campaigns/store-campaign-task-board", () => ({
  StoreCampaignTaskBoard: ({
    storeId,
    instructions,
    instructionTargets,
  }: {
    storeId: string;
    instructions: { title: string }[];
    instructionTargets: { confirmed_at: string | null }[];
  }) =>
    createElement(
      "section",
      null,
      `${storeId}:${instructions[0]?.title}:${instructionTargets[0]?.confirmed_at ?? "未対応"}`,
    ),
}));

import { DeviceCampaignWorkspace } from "@/components/store/device-campaign-workspace";

describe("登録店舗端末の特売指示", () => {
  it("指定店舗の未対応指示を管理ログインなしでタスク一覧へ渡す", () => {
    const html = renderToStaticMarkup(
      createElement(DeviceCampaignWorkspace, {
        snapshot: {
          store: { id: "store-1", name: "架空中央店" },
          instructions: [
            {
              id: "instruction-1",
              title: "週末特売",
              product_id: "product-1",
              product_code: "P001",
              product_name: "架空りんご",
              confirmed_at: null,
            },
          ],
        },
      }),
    );
    expect(html).toContain("store-1:週末特売:未対応");
  });
});
