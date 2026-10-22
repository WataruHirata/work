import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@database/mock/pglite/adapter", () => ({
  tableSpecs: {
    stores: { table: "stores", fields: "id,name", order: "code" },
    areas: { table: "areas", fields: "id,name", order: "code" },
    notifications: { table: "notifications", fields: "id,title,read_at", order: "created_at" },
  },
}));
vi.mock("../database/mysql/pool", () => ({
  mysqlPool: () => ({ execute: mocks.execute }),
  mysqlTransaction: vi.fn(),
}));
import { MysqlRepository, MysqlIdentity } from "../database/mysql/repository";
describe("MySQL個人通知 FR-029 AT-10", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.execute.mockReset();
  });
  it("件数と一覧の両SQLで本人の利用者IDを必須条件にする", async () => {
    vi.spyOn(MysqlIdentity.prototype, "session").mockResolvedValue({
      userId: "fictional-user",
      displayName: "架空利用者",
      active: true,
      mustChangePassword: false,
      roles: ["product_office"],
    });
    mocks.execute
      .mockResolvedValueOnce([[{ total: 1 }]])
      .mockResolvedValueOnce([[{ id: "own", title: "架空通知" }]]);
    const page = await new MysqlRepository().list("notifications");
    expect(page.total).toBe(1);
    for (const [sql, params] of mocks.execute.mock.calls) {
      expect(sql).toContain("WHERE user_id=?");
      expect(params).toEqual(["fictional-user"]);
    }
  });
  it("未認証では通知を取得しない", async () => {
    vi.spyOn(MysqlIdentity.prototype, "session").mockResolvedValue(null);
    await expect(new MysqlRepository().list("notifications")).rejects.toThrow("ログイン");
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("エリア管理者の店舗・エリア選択肢もサーバーで担当範囲に絞る", async () => {
    vi.spyOn(MysqlIdentity.prototype, "session").mockResolvedValue({
      userId: "fictional-area",
      displayName: "架空エリア担当",
      active: true,
      mustChangePassword: false,
      roles: ["area_manager"],
    });
    for (const resource of ["stores", "areas"] as const) {
      mocks.execute.mockReset();
      mocks.execute.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);
      await new MysqlRepository().list(resource);
      for (const [sql, params] of mocks.execute.mock.calls) {
        expect(sql).toContain("EXISTS (SELECT 1 FROM user_role_assignments");
        expect(params).toEqual(["fictional-area"]);
      }
    }
  });
});
