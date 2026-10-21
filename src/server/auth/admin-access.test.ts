import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), from: vi.fn(), createClient: vi.fn(),
  profile: { active: true } as { active: boolean } | null,
  roles: [] as { role: string }[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/infrastructure/supabase/clients/server", () => ({ createSupabaseServerClient: mocks.createClient }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); },
  notFound: () => { throw new Error("NOT_FOUND"); },
}));

import { getAdminSession, requireAdminFeature } from "@/server/auth/admin-access";

describe("AT-10 管理ページのサーバー認可", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fictional.invalid");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fictional-public-key");
    mocks.profile = { active: true };
    mocks.roles = [{ role: "information_systems" }];
    mocks.getUser.mockResolvedValue({ data: { user: { id: "fictional-user" } }, error: null });
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({ eq: () => table === "app_users"
        ? { maybeSingle: async () => ({ data: mocks.profile, error: null }) }
        : Promise.resolve({ data: mocks.roles, error: null }) }),
    }));
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from: mocks.from });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

  it("未設定では実DBへアクセスしない", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect((await requireAdminFeature("users")).status).toBe("unconfigured");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("未ログインの直接URLは戻り先を付けてログインへ誘導する", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthSessionMissingError" } });
    await expect(requireAdminFeature("audit")).rejects.toThrow("REDIRECT:/login?next=%2Fadmin%2Faudit");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("無効化された利用者は管理データを取得できない", async () => {
    mocks.profile = { active: false };
    await expect(requireAdminFeature("users")).rejects.toThrow("NOT_FOUND");
  });
  it("別の管理ロールでは機能URLへの直接アクセスを拒否する", async () => {
    mocks.roles = [{ role: "product_office" }];
    await expect(requireAdminFeature("users")).rejects.toThrow("NOT_FOUND");
    expect((await requireAdminFeature("campaigns")).status).toBe("authorized");
  });
  it("店舗ロールだけでは管理機能へ昇格できない", async () => {
    mocks.roles = [{ role: "store_manager" }];
    await expect(requireAdminFeature()).rejects.toThrow("NOT_FOUND");
  });
  it("認証サービスの障害をログイン成功やデモ表示に置き換えない", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthRetryableFetchError" } });
    await expect(getAdminSession()).rejects.toThrow("認証サービスに接続できません。");
  });
});
