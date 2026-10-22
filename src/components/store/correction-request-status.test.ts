import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CorrectionRequestStatus } from "@/components/store/correction-request-status";

describe("店舗お知らせ画面", () => {
  it("登録店舗から本部へ申請した売上修正状況を状態色付きで表示する", () => {
    const html = renderToStaticMarkup(
      createElement(CorrectionRequestStatus, {
        storeName: "架空みのり中央店",
        salesDays: [{ id: "sales-1", business_date: "2026-10-22" }],
        corrections: [
          {
            id: "correction-1",
            sales_day_id: "sales-1",
            status: "pending_operations_approval",
            requested_at: "2026-10-22T09:00:00+09:00",
            reason: "返品伝票の計上日修正",
            before_amount_yen: 1000,
            after_amount_yen: 1200,
          },
        ],
      }),
    );

    expect(html).toContain("売上修正依頼の申請状況");
    expect(html).toContain("架空みのり中央店から本部へ申請した変更のみ");
    expect(html).toContain("本部承認待ち");
    expect(html).toContain("ui-badge-warning");
    expect(html).toContain("1,000円");
    expect(html).toContain("1,200円");
  });

  it("汎用の店舗お知らせを外し、修正依頼以外の通知だけを残す", () => {
    const queries = readFileSync("src/server/queries/workspaces.ts", "utf8");
    const workspace = readFileSync("src/components/workspaces/data-workspace.tsx", "utf8");
    expect(queries).toContain('storeNotices: ["notifications"]');
    expect(queries).not.toContain('storeNotices: ["announcements"');
    expect(workspace).toContain("filter((row) => !row.correction_id)");
  });

  it("上部のお知らせはスクロールせず、全件表示で下へ展開する", () => {
    const instructions = readFileSync("src/components/campaigns/instruction-workspace.tsx", "utf8");
    const styles = readFileSync("src/app/globals.css", "utf8");
    expect(instructions).toContain("全{instructionCards.length}件を表示");
    expect(instructions).toContain('className="notice-expander"');
    expect(styles).toContain(".notice-expander");
    expect(styles).not.toContain(".notice-scroll-region");
  });
});
