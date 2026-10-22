import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("共通サイドバーとページヘッダー", () => {
  it("店舗ポータル項目を外し、端末状態で登録と解除を切り替える", () => {
    const sidebar = readFileSync("src/components/layout/app-shell.tsx", "utf8");
    const layout = readFileSync("src/app/layout.tsx", "utf8");

    expect(sidebar).not.toContain("uiConfig.pages.dashboard.label");
    expect(sidebar).toContain("stationConnected ? (");
    expect(sidebar).toContain("店舗端末の登録を解除");
    expect(sidebar).toContain("店舗端末を登録");
    expect(sidebar).toContain('href="/login?next=%2Fadmin"');
    expect(sidebar).toContain("権限機能にログイン");
    expect(layout).toContain("cookies()).has(stationCookie)");
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
});
