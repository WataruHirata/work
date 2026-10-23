import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  snapshot: vi.fn(),
  setCookie: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("node:fs", () => ({ existsSync: vi.fn(() => false), readFileSync: vi.fn() }));
vi.mock("@/server/container", () => ({
  repository: () => ({ storeSnapshot: mocks.snapshot }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.setCookie, delete: vi.fn() }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { connectStation } from "@/server/actions/station";

describe("FR-028 / AT-10 デモ店舗端末の接続", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.snapshot.mockResolvedValue({ store: { code: "DEMO-001" } });
  });

  it("サーバー設定のデバイス1でコード入力なしに接続する", async () => {
    const token = "a".repeat(64);
    vi.stubEnv("DEMO_STATION_AUTO_CONNECT", "true");
    vi.stubEnv("DEVICE_DEMO_001_TOKEN", token);

    await connectStation({}, new FormData());

    expect(mocks.snapshot).toHaveBeenCalledWith(token);
    expect(mocks.setCookie).toHaveBeenCalledWith(
      "minoriya-station",
      token,
      expect.objectContaining({ httpOnly: true, sameSite: "strict", path: "/" }),
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });

  it("デバイス1がデモ店舗1以外を指す場合はCookieを発行しない", async () => {
    vi.stubEnv("DEMO_STATION_AUTO_CONNECT", "true");
    vi.stubEnv("DEVICE_DEMO_001_TOKEN", "b".repeat(64));
    mocks.snapshot.mockResolvedValue({ store: { code: "DEMO-002" } });

    const result = await connectStation({}, new FormData());

    expect(result.error).toContain("一致しません");
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("自動接続が無効なら従来どおり入力コードを検証する", async () => {
    vi.stubEnv("DEMO_STATION_AUTO_CONNECT", "false");

    const result = await connectStation({}, new FormData());

    expect(result.error).toContain("64文字");
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
});
