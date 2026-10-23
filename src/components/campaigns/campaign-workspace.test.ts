import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), records: vi.fn(), session: vi.fn() }));
vi.mock("@/server/auth/admin-access", () => ({ requireAdminFeature: mocks.authorize }));
vi.mock("@/server/container", () => ({
  backendConfigured: () => true,
  identity: () => ({ session: mocks.session }),
}));
vi.mock("@/server/queries/workspaces", () => ({ allRecords: mocks.records }));
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
    expect(result.props.campaigns).toHaveLength(25);
    expect(result.props.campaigns[24].storeIds).toEqual(["store1"]);
    expect(result.props.canManage).toBe(true);
    expect(result.props.canApproveStoreWork).toBe(true);
  });
  it("閲覧ロールには特売の管理操作を渡さない", async () => {
    mocks.session.mockResolvedValue({ active: true, roles: ["area_manager"] });
    const result = await CampaignWorkspace({});
    expect(result.props.canManage).toBe(false);
    expect(result.props.canApproveStoreWork).toBe(false);
  });
  it("情報システム管理者には特売の登録・送信操作を渡す", async () => {
    mocks.session.mockResolvedValue({ active: true, roles: ["information_systems"] });
    const result = await CampaignWorkspace({});
    expect(result.props.canManage).toBe(true);
    expect(result.props.canApproveStoreWork).toBe(true);
    expect(result.props.campaigns).toHaveLength(25);
  });
  it("権限確認前に業務データを取得しない", async () => {
    mocks.authorize.mockRejectedValue(new Error("denied"));
    await expect(CampaignWorkspace({})).rejects.toThrow("denied");
    expect(mocks.records).not.toHaveBeenCalled();
  });
});
