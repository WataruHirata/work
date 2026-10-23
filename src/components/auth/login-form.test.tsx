import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/server/actions/auth", () => ({
  signIn: vi.fn(),
  selectAdminRole: vi.fn(),
}));

import { LoginForm } from "@/components/auth/login-form";

describe("ログイン済み利用者の権限選択", () => {
  it("既存セッションがある場合は認証情報を再入力させない", () => {
    const html = renderToStaticMarkup(
      createElement(LoginForm, { initialRoles: ["product_office"] }),
    );
    expect(html).not.toContain('type="email"');
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain("/account/reset");
    expect(html).toContain("商品本部");
    expect(html).toContain("選択した権限で続行");
  });

  it("セッションがない場合は通常のログイン欄を表示する", () => {
    const html = renderToStaticMarkup(createElement(LoginForm));
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
  });
});
