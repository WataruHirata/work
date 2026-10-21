import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAccess: vi.fn(), adminClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/admin-access", () => ({ requireAdminFeature: mocks.requireAccess }));
vi.mock("@/infrastructure/supabase/clients/admin", () => ({ createSupabaseAdminClient: mocks.adminClient }));

import { uploadCsvImport } from "@/server/actions/compatibility";

describe("FR-028 / AT-10 CSV受付のservice_role境界", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it("未ログイン・権限不足では管理クライアントを生成しない", async () => {
    mocks.requireAccess.mockRejectedValue(new Error("Access denied"));
    await expect(uploadCsvImport(new FormData())).rejects.toThrow("Access denied");
    expect(mocks.requireAccess).toHaveBeenCalledWith("imports");
    expect(mocks.adminClient).not.toHaveBeenCalled();
  });
  it("認証未設定を管理者として扱わない", async () => {
    mocks.requireAccess.mockResolvedValue({ status: "unconfigured", roles: [] });
    await expect(uploadCsvImport(new FormData())).rejects.toThrow("認証済みの情報システム権限が必要です。");
    expect(mocks.adminClient).not.toHaveBeenCalled();
  });
});
