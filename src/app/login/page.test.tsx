import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  selectedRole: undefined as string | undefined,
  loginProps: vi.fn(),
}));

vi.mock("@/server/container", () => ({
  backendConfigured: () => true,
  identity: () => ({ session: mocks.session }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (mocks.selectedRole ? { value: mocks.selectedRole } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("@/components/auth/login-form", () => ({
  LoginForm: (props: unknown) => {
    mocks.loginProps(props);
    return createElement("div", null, "login-form");
  },
}));
vi.mock("@/components/ui/page-layout", () => ({
  PageLayout: ({ children }: { children: ReactNode }) => createElement("main", null, children),
}));

import LoginPage from "@/app/login/page";

describe("8時間セッションの管理入口", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectedRole = undefined;
  });

  it("ログイン済みで権限未選択ならパスワード入力を繰り返さず権限選択へ進む", async () => {
    mocks.session.mockResolvedValue({
      active: true,
      mustChangePassword: false,
      roles: ["product_office", "information_systems"],
    });
    renderToStaticMarkup(
      await LoginPage({ searchParams: Promise.resolve({ next: "/admin/campaigns" }) }),
    );
    expect(mocks.loginProps).toHaveBeenCalledWith(
      expect.objectContaining({ initialRoles: ["product_office", "information_systems"] }),
    );
  });

  it("選択中の権限も有効なら許可された管理画面へ直接進む", async () => {
    mocks.selectedRole = "product_office";
    mocks.session.mockResolvedValue({
      active: true,
      mustChangePassword: false,
      roles: ["product_office"],
    });
    await expect(
      LoginPage({ searchParams: Promise.resolve({ next: "/admin/campaigns" }) }),
    ).rejects.toThrow("REDIRECT:/admin/campaigns");
  });
});
