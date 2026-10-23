import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), records: vi.fn(), session: vi.fn() }));
vi.mock("@/server/auth/admin-access", () => ({ requireAdminFeature: mocks.authorize }));
vi.mock("@/server/container", () => ({
  backendConfigured: () => true,
  identity: () => ({ session: mocks.session }),
}));
vi.mock("@/server/queries/workspaces", () => ({
  allRecords: mocks.records,
  featureResources: {
    campaigns: ["campaigns", "campaignItems", "campaignTargets", "campaignTasks"],
  },
}));
vi.mock("@/components/campaigns/campaign-management", () => ({ CampaignManagement: () => null }));
vi.mock("@/components/campaigns/instruction-workspace", () => ({
  InstructionWorkspace: () => null,
}));
vi.mock("@/components/preview/preview-workspace", () => ({ PreviewWorkspace: () => null }));
import { CampaignWorkspace } from "@/components/campaigns/campaign-workspace";
describe("特売画面 FR-020/028 AT-07/10", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ status: "authorized" });
    mocks.session.mockResolvedValue({ active: true, roles: ["product_office"] });
    mocks.records.mockImplementation(async (resource: string) =>
      resource === "stores"
        ? [{ id: "store1", code: "S1", name: "架空中央店", status: "active" }]
        : resource === "campaigns"
          ? Array.from({ length: 25 }, (_, i) => ({
              id: `c${i}`,
              name: `架空特売${i}`,
              starts_at: "2026-10-23T00:00:00Z",
              ends_at: "2026-10-24T00:00:00Z",
              status: "draft",
              created_at: "2026-10-22T00:00:00Z",
            }))
          : resource === "campaignTargets"
            ? [{ id: "t1", campaign_id: "c24", store_id: "store1" }]
            : [],
    );
  });
  it("20件を超える特売と対象店舗を一覧に渡す", async () => {
    const result = await CampaignWorkspace({});
    const management = result.props.children;
    expect(management.props.campaigns).toHaveLength(25);
    expect(management.props.campaigns[24].storeIds).toEqual(["store1"]);
    expect(management.props.canManage).toBe(true);
    expect(result.props.eyebrow).toBe("PROMOTION OPERATIONS");
  });
  it("閲覧ロールには特売の管理操作を渡さない", async () => {
    mocks.session.mockResolvedValue({ active: true, roles: ["area_manager"] });
    const result = await CampaignWorkspace({});
    expect(result.props.children.props.canManage).toBe(false);
  });
  it("店舗の特売画面にはお知らせ用の作業依頼パネルを重複表示しない", async () => {
    mocks.session.mockResolvedValue({
      active: true,
      roles: ["store_manager"],
      storeIds: ["store1"],
    });
    const result = await CampaignWorkspace({ storeMode: true, storeId: "store1" });
    const management = result.props.children;
    expect(management.props.instructionPanel).toBeTruthy();
    expect(management.props.basePath).toBe("/store/campaigns");
  });
  it("権限確認前に業務データを取得しない", async () => {
    mocks.authorize.mockRejectedValue(new Error("denied"));
    await expect(CampaignWorkspace({})).rejects.toThrow("denied");
    expect(mocks.records).not.toHaveBeenCalled();
  });
  it("特売データの取得失敗を空画面にせず再試行案内にする", async () => {
    mocks.records.mockRejectedValue(new Error("database unavailable"));
    const html = renderToStaticMarkup(await CampaignWorkspace({}));
    expect(html).toContain("特売情報を読み込めませんでした");
    expect(html).toContain("データベース接続と特売用マイグレーション");
    expect(html).toContain('href="/admin/campaigns"');
    expect(html).not.toContain("database unavailable");
  });
});
