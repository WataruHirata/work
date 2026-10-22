import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ roles: vi.fn(), execute: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/server/container", () => ({ repository: () => ({ execute: mocks.execute }) }));
vi.mock("@/server/auth/session", () => ({ requireRoles: mocks.roles, activeSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { publishCampaignDraftAction } from "@/server/actions/campaigns";
describe("特売依頼送信 FR-020/028/029 AT-07/10", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.roles.mockResolvedValue({});
    mocks.execute.mockResolvedValue(null);
  });
  it("期間・商品・価格・店舗の確認なしに送信しない", async () => {
    const data = new FormData();
    data.set("campaignId", "10000000-0000-4000-8000-000000000001");
    expect((await publishCampaignDraftAction({}, data)).error).toContain("確認");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("確認後に送信し店舗のお知らせも再検証する", async () => {
    const data = new FormData();
    data.set("campaignId", "10000000-0000-4000-8000-000000000001");
    data.set("confirmed", "true");
    expect((await publishCampaignDraftAction({}, data)).success).toContain("POS・値札");
    expect(mocks.execute).toHaveBeenCalledWith("publishCampaign", {
      p_campaign_id: "10000000-0000-4000-8000-000000000001",
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/store", "layout");
  });
});
