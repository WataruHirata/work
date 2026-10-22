import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), records: vi.fn(), configured: vi.fn() }));
vi.mock("@/server/auth/admin-access", () => ({ requireAdminFeature: mocks.authorize }));
vi.mock("@/server/container", () => ({ backendConfigured: mocks.configured }));
vi.mock("@/server/queries/workspaces", () => ({ allRecords: mocks.records }));
vi.mock("@/components/preview/preview-workspace", () => ({ PreviewWorkspace: () => null }));
import { SalesWorkspace } from "@/components/sales/sales-workspace";
const store = "20000000-0000-4000-8000-000000000001";
const other = "20000000-0000-4000-8000-000000000002";
const area = "10000000-0000-4000-8000-000000000001";
describe("管理売上画面 FR-005/006 AT-03/10", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ status: "authorized" });
    mocks.configured.mockReturnValue(true);
    mocks.records.mockImplementation(async (resource: string) =>
      resource === "stores"
        ? [{ id: store, code: "DEMO-1", name: "架空中央店", area_id: area }]
        : resource === "areas"
          ? [{ id: area, name: "架空エリア" }]
          : [
              {
                id: "sale1",
                store_id: store,
                business_date: "2026-10-22",
                net_sales_yen: "1001",
                gross_sales_yen: "1101",
                customer_count: 2,
                transaction_count: 3,
                status: "confirmed",
              },
              {
                id: "sale2",
                store_id: other,
                business_date: "2026-10-22",
                net_sales_yen: "9999",
                gross_sales_yen: "9999",
                customer_count: 2,
                transaction_count: 3,
                status: "confirmed",
              },
            ],
    );
  });
  it("権限範囲内の店舗だけを集計し日付と金額を表示する", async () => {
    const html = renderToStaticMarkup(await SalesWorkspace({ search: {} }));
    expect(html).toContain("¥1,001");
    expect(html).not.toContain("¥9,999");
    expect(html).toContain("2026-10-22");
    expect(html).toContain("店舗別比較");
    expect(mocks.authorize).toHaveBeenCalledWith("sales");
  });
  it("期間・店舗の絞り込みをサーバーの取得条件に渡す", async () => {
    await SalesWorkspace({ search: { from: "2026-10-01", to: "2026-10-22", store } });
    expect(mocks.records).toHaveBeenCalledWith("sales", {
      from: "2026-10-01",
      to: "2026-10-22",
      storeId: store,
    });
  });
  it("逆転した期間と範囲外の店舗を拒否し売上を取得しない", async () => {
    let html = renderToStaticMarkup(
      await SalesWorkspace({ search: { from: "2026-10-22", to: "2026-10-01" } }),
    );
    expect(html).toContain("終了日は開始日以降");
    expect(mocks.records).not.toHaveBeenCalled();
    html = renderToStaticMarkup(await SalesWorkspace({ search: { store: other } }));
    expect(html).toContain("対象店舗を参照できません");
    expect(mocks.records.mock.calls.some(([resource]) => resource === "sales")).toBe(false);
  });
  it("権限のない利用者についてデータを取得しない", async () => {
    mocks.authorize.mockRejectedValue(new Error("denied"));
    await expect(SalesWorkspace({ search: {} })).rejects.toThrow("denied");
    expect(mocks.records).not.toHaveBeenCalled();
  });
  it("取得失敗と空状態を案内する", async () => {
    mocks.records.mockRejectedValueOnce(new Error("接続失敗"));
    expect(renderToStaticMarkup(await SalesWorkspace({ search: {} }))).toContain("接続失敗");
    mocks.records.mockResolvedValue([]);
    expect(renderToStaticMarkup(await SalesWorkspace({ search: {} }))).toContain(
      "条件に一致する売上はありません",
    );
  });
});
