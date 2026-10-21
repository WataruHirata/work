import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { responsiveStyles, uiConfig } from "@/config/ui";
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
      readFileSync("src/components/legacy/sales-dashboard.tsx", "utf8");
    const names = [...styles.matchAll(/var\((--[\w-]+)\)/g)].map(
      (match) => match[1],
    );
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(uiConfig.theme).toHaveProperty(name);
  });

  it("動き抑制ではアニメーション・遷移・自動スクロールを抑制する", () => {
    const reducedMotion = responsiveStyles.split(
      "@media (prefers-reduced-motion: reduce)",
    )[1];
    expect(reducedMotion).toContain("animation: none !important");
    expect(reducedMotion).toContain("transition: none !important");
    expect(reducedMotion).toContain("scroll-behavior: auto !important");
  });
});
