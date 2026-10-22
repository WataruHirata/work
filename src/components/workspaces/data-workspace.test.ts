import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("店舗売上・在庫のテーブル表示", () => {
  it("売上・在庫ページに次ページボタンを出さない", () => {
    const source = readFileSync("src/components/workspaces/data-workspace.tsx", "utf8");
    expect(source).toMatch(/feature !== "storeSales" &&\s*pages\.some/);
  });

  it("全ページのテーブル見出しとセルに共通の高コントラスト文字色を使う", () => {
    const styles = readFileSync("src/app/globals.css", "utf8");
    expect(styles).toMatch(/\.data-table th,\s*table th\s*\{[^}]*color:\s*var\(--text-strong\)/s);
    expect(styles).toMatch(/\.data-table td,\s*table td\s*\{[^}]*color:\s*var\(--text\)/s);
  });
});
