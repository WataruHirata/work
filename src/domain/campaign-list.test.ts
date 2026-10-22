import { describe, expect, it } from "vitest";
import { filterCampaigns } from "@/domain/campaign-list";
const rows = Array.from({ length: 25 }, (_, i) => ({
  name: `架空特売 ${i}`,
  status: i % 2 ? "active" : "draft",
  storeIds: [i % 2 ? "a" : "b"],
}));
describe("特売一覧 FR-020/028 AT-07/10", () => {
  it("20件を超える特売も検索できる", () => {
    expect(filterCampaigns(rows, "架空特売 24", "")).toEqual([rows[24]]);
  });
  it("状態・店舗・名称を組み合わせて絞り込む", () => {
    expect(filterCampaigns(rows, "架空特売 1", "active", "a")).toHaveLength(6);
    expect(filterCampaigns(rows, "", "active", "b")).toEqual([]);
    expect(filterCampaigns([], "", "")).toEqual([]);
  });
});
