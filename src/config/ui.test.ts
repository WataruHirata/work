import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { responsiveStyles, stateTone, uiConfig } from "@/config/ui";
import { existsSync } from "node:fs";

describe("UI共通設定（AT-03 / AT-10 の表示・操作基盤）", () => {
  it("全ページとナビゲーションが実在するTSX画面を参照する", () => {
    const routes = Object.values(uiConfig.pages).map(({ href }) => href);
    expect(new Set(routes).size).toBe(routes.length);
    for (const { href } of Object.values(uiConfig.pages)) {
      const file = `src/app${href === "/" ? "" : href}/page.tsx`;
      const dynamicFile = href.startsWith("/admin/")
        ? "src/app/admin/[feature]/page.tsx"
        : "src/app/store/[feature]/page.tsx";
      const page = readFileSync(existsSync(file) ? file : dynamicFile, "utf8");
      expect(page).toContain("export default");
    }
    for (const id of uiConfig.navigation) {
      expect(uiConfig.pages[id].label).not.toBe("");
    }
  });

  it("全CSSとSVGの参照トークンが共通設定で定義される", () => {
    const styles =
      readFileSync("src/app/globals.css", "utf8") +
      responsiveStyles +
      readFileSync("src/components/legacy/sales-dashboard.tsx", "utf8") +
      readFileSync("src/components/preview/preview-instructions.module.css", "utf8");
    const names = [...styles.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(uiConfig.theme).toHaveProperty(name);
  });

  it("UI刷新の共通属性を全画面向けテーマとして保持する", () => {
    expect(uiConfig.theme).toMatchObject({
      "--text": "#172720",
      "--text-strong": "#0b2f57",
      "--text-subtle": "#4f5f56",
      "--border": "#e4ebe7",
      "--surface": "#ffffff",
      "--surface-subtle": "#f8fafc",
      "--accent": "#2e75b6",
      "--accent-strong": "#0b2f57",
      "--success": "#2c7a5f",
      "--warning": "#b96c38",
      "--focus": "#2e75b6",
      "--font-size-body": "15px",
      "--font-size-kpi": "24px",
      "--radius-control": "8px",
      "--radius-panel": "12px",
      "--card-padding": "22px",
      "--control-height": "44px",
      "--disabled-surface": "#e9efec",
    });
    const styles = readFileSync("src/app/globals.css", "utf8");
    expect(styles).toMatch(
      /\.table-expand-actions,\s*\.list-expand-actions\s*\{[^}]*position:\s*absolute[^}]*top:\s*0[^}]*right:\s*0/s,
    );
    expect(styles).toMatch(/table\s*\{[^}]*min-width:\s*0[^}]*table-layout:\s*fixed/s);
    expect(styles).not.toContain("overflow-x: auto");
    expect(uiConfig.theme["--green"]).toBe("var(--accent)");
    expect(uiConfig.theme["--green-dark"]).toBe("var(--accent-strong)");
    expect(uiConfig.theme["--panel"]).toBe("var(--surface)");
  });

  it("旧店舗ポータルの指標・グラフ・サンプル色を共通テーマへ結び付ける", () => {
    const styles = readFileSync("src/app/globals.css", "utf8");
    expect(styles).toMatch(
      /\.green-icon\s*\{[^}]*background:\s*var\(--accent-soft\)[^}]*color:\s*var\(--accent-strong\)/s,
    );
    expect(styles).toMatch(
      /\.demo-badge\s*\{[^}]*background:\s*var\(--accent-soft\)[^}]*color:\s*var\(--accent-strong\)/s,
    );
    expect(styles).toMatch(/\.chart-line\s*\{[^}]*stroke:\s*var\(--accent\)/s);
    expect(styles).toMatch(/\.chart-point\s*\{[^}]*stroke:\s*var\(--accent\)/s);
    expect(styles).toMatch(
      /\.metric-value\s*\{[^}]*color:\s*var\(--text-strong\)[^}]*font-size:\s*var\(--font-size-kpi\)[^}]*letter-spacing:\s*normal/s,
    );
    expect(styles).toMatch(
      /\.department-list li > div:first-child\s*\{[^}]*font-size:\s*var\(--font-size-label\)/s,
    );
  });

  it("データ状態を共通の警告・成功・中立色へ分類する", () => {
    expect(stateTone("pending_area_approval")).toBe("warning");
    expect(stateTone("failed")).toBe("warning");
    expect(stateTone("completed")).toBe("success");
    expect(stateTone("monthly_finalized")).toBe("success");
    expect(stateTone("draft")).toBe("neutral");
  });

  it("カード・ボタン・Badge・Gridの共通フォーマットを実クラスへ適用する", () => {
    const styles = readFileSync("src/app/globals.css", "utf8");
    for (const className of [
      ".ui-workspace",
      ".ui-card",
      ".ui-button-primary",
      ".ui-button-secondary",
      ".ui-badge-warning",
      ".ui-badge-success",
      ".page-panel",
      ".primary-button",
      ".ghost-button",
      ".badge",
    ]) {
      expect(styles).toContain(className);
    }
    expect(styles).toContain("padding: var(--card-padding)");
    expect(styles).toContain("min-height: var(--control-height)");
    expect(styles).toContain(".status.ui-badge-warning");
    expect(styles).toContain("font-size: var(--font-size-page-title)");
    expect(styles).toContain("line-height: 1.8");
    expect(responsiveStyles).toContain("@media (max-width: 700px)");
  });

  it("動き抑制ではアニメーション・遷移・自動スクロールを抑制する", () => {
    const reducedMotion = responsiveStyles.split("@media (prefers-reduced-motion: reduce)")[1];
    expect(reducedMotion).toContain("animation: none !important");
    expect(reducedMotion).toContain("transition: none !important");
    expect(reducedMotion).toContain("scroll-behavior: auto !important");
  });
});
