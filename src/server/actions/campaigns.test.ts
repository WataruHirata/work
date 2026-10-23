import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ roles: vi.fn(), execute: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/server/container", () => ({ repository: () => ({ execute: mocks.execute }) }));
vi.mock("@/server/auth/session", () => ({ requireRoles: mocks.roles, activeSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import {
  approveCampaignWorkAction,
  publishCampaignDraftAction,
  updateCampaignProgressAction,
} from "@/server/actions/campaigns";
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
    expect(mocks.revalidate).toHaveBeenCalledWith("/store/notices");
  });
  it("店舗担当者のPOS変更完了を特売タスクとして保存する", async () => {
    const data = new FormData();
    data.set("campaignItemId", "10000000-0000-4000-8000-000000000001");
    data.set("storeId", "20000000-0000-4000-8000-000000000002");
    data.set("task", "pos_changed");
    data.set("completed", "true");
    expect((await updateCampaignProgressAction({}, data)).success).toContain("保存");
    expect(mocks.execute).toHaveBeenCalledWith("updateCampaignTask", {
      p_campaign_item_id: "10000000-0000-4000-8000-000000000001",
      p_store_id: "20000000-0000-4000-8000-000000000002",
      p_task: "pos_changed",
      p_completed: true,
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/store/notices");
  });
  it("商品本部が店舗のPOS・値札完了を確認して承認する", async () => {
    const data = new FormData();
    data.set("campaignItemId", "10000000-0000-4000-8000-000000000001");
    data.set("storeId", "20000000-0000-4000-8000-000000000002");
    data.set("confirmed", "true");
    expect((await approveCampaignWorkAction({}, data)).success).toContain("承認");
    expect(mocks.roles).toHaveBeenCalledWith(["product_office", "information_systems"]);
    expect(mocks.execute).toHaveBeenCalledWith("approveCampaignWork", {
      p_campaign_item_id: "10000000-0000-4000-8000-000000000001",
      p_store_id: "20000000-0000-4000-8000-000000000002",
    });
  });
  it("店舗作業の確認なしでは承認しない", async () => {
    const data = new FormData();
    data.set("campaignItemId", "10000000-0000-4000-8000-000000000001");
    data.set("storeId", "20000000-0000-4000-8000-000000000002");
    expect((await approveCampaignWorkAction({}, data)).error).toContain("確認");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
