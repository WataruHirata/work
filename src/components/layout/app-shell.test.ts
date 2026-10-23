import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("共通サイドバーとページヘッダー", () => {
  it("店舗ポータルをナビゲーションに含め、端末状態で登録と解除を切り替える", () => {
    const sidebar = readFileSync("src/components/layout/app-shell.tsx", "utf8");
    const layout = readFileSync("src/app/layout.tsx", "utf8");

    expect(sidebar).toContain("uiConfig.navigation.map");
    expect(readFileSync("src/config/ui.ts", "utf8")).toContain(
      'navigation: ["dashboard", "storeSales", "storeInventory"',
    );
    expect(sidebar).toContain("stationConnected ? (");
    expect(sidebar).toContain("店舗端末の登録を解除");
    expect(sidebar).toContain("店舗端末を登録");
    expect(sidebar).toContain('"/login?next=%2Fadmin"');
    expect(sidebar).toContain("権限機能にログイン");
    expect(sidebar).toContain("管理メニューへ");
    expect(sidebar).toContain("利用する権限を選択");
    expect(sidebar).toContain("権限機能からログアウト");
    expect(sidebar).not.toContain("個人ログインを終了");
    expect(sidebar).not.toContain("個人アカウント");
    expect(layout).toContain("cookieStore.has(stationCookie)");
    expect(layout).toContain("adminEntryState={adminEntryState}");
  });

  it("共通シェルにプルトゥリフレッシュと操作可能なスワイプドロワーを備える", () => {
    const sidebar = readFileSync("src/components/layout/app-shell.tsx", "utf8");
    const loading = readFileSync("src/app/loading.tsx", "utf8");
    const styles = readFileSync("src/app/globals.css", "utf8");
    const responsive = readFileSync("src/config/ui.ts", "utf8");

    expect(sidebar).toContain("router.refresh()");
    expect(sidebar).toContain('"touchmove", onTouchMove, { passive: false }');
    expect(sidebar).toContain("resolveSwipeAction");
    expect(sidebar).toContain("メニューを閉じる");
    expect(loading).toContain("loading-skeleton");
    expect(styles).toContain("infographic-line-draw");
    expect(styles).toContain("kinetic-type-enter");
    expect(responsive).toContain("@media (prefers-reduced-motion: reduce)");
    expect(responsive).toContain(".global-sidebar");
  });

  it("画面本文から権限ログインへの重複リンクをなくす", () => {
    const storeFeature = readFileSync("src/app/store/[feature]/page.tsx", "utf8");
    const deviceWorkspace = readFileSync("src/components/store/device-workspace.tsx", "utf8");
    expect(storeFeature).not.toContain("/login");
    expect(deviceWorkspace).not.toContain("/login");
  });

  it("全ページ共通ヘッダーに十分な高さと上下の余白を設定する", () => {
    const styles = readFileSync("src/app/globals.css", "utf8");
    expect(styles).toMatch(
      /\.page-topbar\s*\{[^}]*min-height:\s*var\(--size-84px\)[^}]*padding:\s*var\(--space-2\)/s,
    );
    expect(styles).toMatch(
      /\.global-topbar\s*\{[^}]*min-height:\s*var\(--size-84px\)[^}]*padding:\s*var\(--space-2\)/s,
    );
  });

  it("店舗ポータルだけを画面内固定レイアウトにする", () => {
    const sidebar = readFileSync("src/components/layout/app-shell.tsx", "utf8");
    const styles = readFileSync("src/app/globals.css", "utf8");

    expect(sidebar).toContain('pathname === "/" ? " store-portal-main"');
    expect(styles).toMatch(/\.store-portal-main\s*\{[^}]*height:\s*100dvh[^}]*overflow:\s*hidden/s);
    expect(styles).toMatch(
      /\.store-portal-main \.store-sales-trend-panel\s*\{[^}]*grid-template-rows:[^}]*10\.75rem[^}]*23vh/s,
    );
    expect(styles).toMatch(
      /\.store-portal-main \.store-sales-table-scroll tbody\s*\{[^}]*overflow-y:\s*auto/s,
    );
    expect(styles).toMatch(
      /\.store-portal-main \.store-sales-table-scroll caption,\s*\.store-portal-main \.store-sales-table-scroll thead/,
    );
    expect(styles).toContain(".store-portal-main .store-compact-metrics");
  });

  it("狭幅画面では共通グリッドとサイドバーを画面幅内に収める", () => {
    const styles = readFileSync("src/app/globals.css", "utf8");

    expect(styles).toMatch(
      /@media \(max-width: 900px\)[\s\S]*?\.page-grid[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 700px\)[\s\S]*?\.global-sidebar[\s\S]*?position:\s*fixed/,
    );
    expect(styles).toMatch(
      /\.notification-dialog\s*\{[^}]*overflow-y:\s*auto[^}]*overscroll-behavior:\s*contain/s,
    );
  });
});
