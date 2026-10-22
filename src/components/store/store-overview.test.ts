import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StoreOverview } from "@/components/store/store-overview";

describe("店舗概況（FR-005/006・AT-03/10 表示基盤）", () => {
  it("公開ポータルでサンプルを明示し、本文に機能・管理への重複リンクを含めない", () => {
    const html = renderToStaticMarkup(createElement(StoreOverview));
    expect(html).toContain("架空のサンプルデータ");
    expect(html).toContain("未確定");
    expect(html).not.toContain("href=");
  });

  it("日次表の売上と7日間合計・客単価・部門構成が整合する", () => {
    const html = renderToStaticMarkup(createElement(StoreOverview));
    const table = html.match(/<tbody>(.*?)<\/tbody>/)?.[1] ?? "";
    const amounts = [...table.matchAll(/<td>¥([\d,]+)<\/td>/g)].map((match) =>
      Number(match[1].replaceAll(",", "")),
    );
    expect(amounts).toHaveLength(7);
    expect(html).toContain(
      `¥${amounts.reduce((sum, value) => sum + value, 0).toLocaleString("ja-JP")}`,
    );
    expect(html).toContain("¥1,200");
    const departments = html.match(/<ul class="department-list">(.*?)<\/ul>/)?.[1] ?? "";
    const departmentSales = [...departments.matchAll(/¥([\d,]+)/g)].map((match) =>
      Number(match[1].replaceAll(",", "")),
    );
    expect(departmentSales.reduce((sum, value) => sum + value, 0)).toBe(amounts[6]);
    expect(html).toContain("<caption>");
    expect(html.match(/<circle /g)).toHaveLength(7);
  });
});
