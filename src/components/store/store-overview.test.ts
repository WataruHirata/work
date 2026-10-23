import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StoreOverview } from "@/components/store/store-overview";
import { LiveStoreOverview } from "@/components/store/live-store-overview";
import { SalesCompositionChart } from "@/components/store/sales-composition-chart";
import { PageLayout } from "@/components/ui/page-layout";

describe("店舗概況（FR-005/006・AT-03/10 表示基盤）", () => {
  it("品目別円グラフの凡例は上位3件に固定し、残りをその他として集計する", () => {
    const html = renderToStaticMarkup(
      createElement(SalesCompositionChart, {
        items: [
          { name: "商品A", sales: 50 },
          { name: "商品B", sales: 20 },
          { name: "商品C", sales: 15 },
          { name: "商品D", sales: 10 },
          { name: "商品E", sales: 5 },
        ],
        total: 100,
        formatValue: (value: number) => `¥${value}`,
      }),
    );
    const legend = html.match(/<ul class="department-donut-legend">(.*?)<\/ul>/)?.[1] ?? "";
    expect(legend.match(/<li>/g)).toHaveLength(3);
    expect(legend).toContain("商品A");
    expect(legend).not.toContain("商品D");
    expect(html).toContain("その他 ¥15 15パーセント");
  });

  it("公開ポータルでサンプルを明示し、本文に機能・管理への重複リンクを含めない", () => {
    const html = renderToStaticMarkup(createElement(StoreOverview));
    expect(html).toContain("架空のサンプルデータ");
    expect(html).toContain("未確定");
    expect(html).not.toContain("href=");
  });

  it("ポータルの売上推移は等間隔の横軸と全行スクロール表を表示し、集計も維持する", () => {
    const html = renderToStaticMarkup(createElement(StoreOverview));
    const table = html.match(/<tbody[^>]*>(.*?)<\/tbody>/)?.[1] ?? "";
    const amounts = [...table.matchAll(/<td>¥([\d,]+)<\/td>/g)].map((match) =>
      Number(match[1].replaceAll(",", "")),
    );
    expect(amounts).toHaveLength(7);
    expect(html).toContain('details class="store-data" open=""');
    expect(html).toContain('class="table-scroll store-sales-table-scroll"');
    expect(html).not.toContain("閉じる");
    expect(html).not.toContain("全件表示");
    expect(html).toContain("¥6,528,000");
    expect(html).toContain("¥1,200");
    const departments = html.match(/<ul class="department-list">(.*?)<\/ul>/)?.[1] ?? "";
    const departmentSales = [...departments.matchAll(/¥([\d,]+)/g)].map((match) =>
      Number(match[1].replaceAll(",", "")),
    );
    expect(departmentSales.reduce((sum, value) => sum + value, 0)).toBe(960000);
    expect(html).toContain("<caption>");
    expect(html.match(/<circle /g)).toHaveLength(7);
    expect(html).toContain('x1="50" x2="50"');
    expect(html).toContain('x1="150" x2="150"');
    expect(html).toContain('x1="650" x2="650"');
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
          metrics: {
            inventory_alert_count: 2,
            notice_count: 5,
            campaign_pending_count: 3,
          },
          notices: [
            {
              id: "notice-1",
              title: "営業時間変更のお知らせ",
              message: "本日は18時に閉店します。",
              created_at: "2026-10-21T01:00:00.000Z",
            },
          ],
          salesComposition: [
            { name: "架空りんご", sales: 60 },
            { name: "架空幕の内弁当", sales: 40 },
          ],
        },
      }),
    );
    expect(html).not.toContain("締め前");
    expect(html).not.toContain("未取込");
    expect(html).not.toContain('<th scope="col">状態</th>');
    expect(html).toContain('href="/store/sales"');
    expect(html).toContain('href="/store/inventory"');
    expect(html).toContain('href="/store/notices"');
    expect(html).toContain('href="/store/campaigns"');
    expect(html).toContain(">2件</strong>");
    expect(html).toContain(">5件</strong>");
    expect(html).toContain(">3件</strong>");
    expect(html).not.toContain("営業時間変更のお知らせ");
    expect(html).not.toContain("本日は18時に閉店します。");
    expect(html).toContain('class="department-donut"');
    expect(html).toContain('class="sales-composition-chart"');
    expect(html).toContain('class="sales-donut-reveal"');
    expect(html).toContain("架空りんご");
    expect(html).toContain("¥60");
    expect(html).toContain("売上合計");
    expect(html).toContain("60%");
    expect(html).toContain("2026-10-21");
    expect(html).toContain("chart-line chart-line-glow");
    expect(html).toContain("chart-latest-ring");
    expect(html).toContain('class="table-scroll store-sales-table-scroll"');
    expect(html).not.toContain("全件表示");
  });

  it("部門合計が直近営業日の売上と一致しない場合は構成比を表示しない", () => {
    const html = renderToStaticMarkup(
      createElement(LiveStoreOverview, {
        snapshot: {
          store: { name: "架空中央店" },
          sales: [
            {
              business_date: "2026-10-21",
              net_sales_yen: 100,
              customer_count: 2,
              status: "imported",
            },
          ],
          salesComposition: [{ name: "架空りんご", sales: 90 }],
        },
      }),
    );
    expect(html).not.toContain('class="department-donut"');
    expect(html).not.toContain('class="sales-composition-chart"');
  });

  it("接続ポータルの見出しを既存ヘッダー内に配置する", () => {
    const html = renderToStaticMarkup(
      PageLayout({
        page: "dashboard",
        headerContent: createElement(
          "div",
          null,
          createElement("p", null, "STORE OVERVIEW"),
          createElement("h1", null, "デモ店"),
          createElement("p", null, "直近営業日 2026-10-21"),
        ),
        children: "ポータル内容",
      }),
    );
    const header = html.match(/<header class="page-topbar[^>]*>(.*?)<\/header>/)?.[1] ?? "";
    expect(header).toContain("STORE OVERVIEW");
    expect(header).toContain("デモ店");
    expect(header).toContain("直近営業日 2026-10-21");
    expect(html.indexOf("STORE OVERVIEW")).toBeLessThan(html.indexOf("ポータル内容"));
  });

  it("自店舗の売上ページに戻るボタンを表示しない", () => {
    const html = renderToStaticMarkup(PageLayout({ page: "storeSales", children: "売上" }));
    expect(html).not.toContain("へ戻る");
    expect(html).toContain("<h1>売上</h1>");
    expect(html).not.toContain("自店舗 売上");
  });
});
