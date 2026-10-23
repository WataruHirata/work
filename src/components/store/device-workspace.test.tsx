import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/page-layout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) =>
    createElement("main", null, children),
}));

import { DeviceWorkspace } from "@/components/store/device-workspace";

describe("店舗端末の特売確認 FR-020/028 AT-07/10", () => {
  it("管理者ログインなしで商品・価格・期間・作業状態を表示する", () => {
    const html = renderToStaticMarkup(
      createElement(DeviceWorkspace, {
        feature: "storeCampaigns",
        snapshot: {
          store: { name: "架空中央店" },
          campaigns: [
            {
              name: "週末特売",
              product_code: "P001",
              product_name: "架空りんご",
              price_yen: 198,
              starts_at: "2026-10-24T00:00:00.000Z",
              ends_at: "2026-10-25T00:00:00.000Z",
              status: "scheduled",
              pos_promotion_status: "not_configured",
              price_label_changed_at: null,
              work_approved_at: null,
            },
          ],
        },
      }),
    );

    expect(html).toContain("管理者ログインなしで確認できる店舗端末");
    expect(html).toContain("架空りんご");
    expect(html).toContain("198");
    expect(html).toContain("POS価格変更");
    expect(html).toContain("管理者権限は必要ありません");
  });
});
