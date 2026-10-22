import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StoreOverview } from "@/components/store/store-overview";
import { LiveStoreOverview } from "@/components/store/live-store-overview";
import { PageLayout } from "@/components/ui/page-layout";

describe("店舗概況（FR-005/006・AT-03/10 表示基盤）", () => {
  it("公開ポータルでサンプルを明示し、本文に機能・管理への重複リンクを含めない", () => {
    const html = renderToStaticMarkup(createElement(StoreOverview));
    expect(html).toContain("架空のサンプルデータ");
    expect(html).toContain("未確定");
    expect(html).not.toContain("href=");
  });

  it("日次表は初期3件に折りたたみ、全件表示と集計を維持する", () => {
    const html = renderToStaticMarkup(createElement(StoreOverview));
    const table = html.match(/<tbody[^>]*>(.*?)<\/tbody>/)?.[1] ?? "";
    const amounts = [...table.matchAll(/<td>¥([\d,]+)<\/td>/g)].map((match) =>
      Number(match[1].replaceAll(",", "")),
    );
    expect(amounts).toHaveLength(3);
    expect(html).toContain("全件表示");
    expect(html).toContain("¥6,528,000");
    expect(html).toContain("¥1,200");
    const departments = html.match(/<ul class="department-list">(.*?)<\/ul>/)?.[1] ?? "";
    const departmentSales = [...departments.matchAll(/¥([\d,]+)/g)].map((match) =>
      Number(match[1].replaceAll(",", "")),
    );
    expect(departmentSales.reduce((sum, value) => sum + value, 0)).toBe(960000);
    expect(html).toContain("<caption>");
    expect(html.match(/<circle /g)).toHaveLength(7);
  });

  it("店舗ポータルの売上状況から締め前ステータスを表示しない", () => {
    const html = renderToStaticMarkup(
      createElement(LiveStoreOverview, {
        snapshot: {
          store: { name: "デモ中央店" },
          sales: [
            {
              business_date: "2026-10-21",
              net_sales_yen: 100,
              customer_count: 2,
              status: "imported",
            },
          ],
        },
      }),
    );
    expect(html).not.toContain("締め前");
    expect(html).not.toContain("未取込");
    expect(html).not.toContain('<th scope="col">状態</th>');
  });

  it("自店舗の売上・在庫ページに戻るボタンを表示しない", () => {
    const html = renderToStaticMarkup(PageLayout({ page: "storeSales", children: "売上・在庫" }));
    expect(html).not.toContain("へ戻る");
  });
});
