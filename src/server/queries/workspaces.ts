import "server-only";
import { repository } from "@/server/container";
import type { DataRecord, QueryOptions, Resource } from "@/domain/contracts";

export const featureResources: Record<string, Resource[]> = {
  sales: ["sales"],
  products: ["products", "prices"],
  campaigns: ["campaigns", "campaignItems", "campaignTargets", "campaignTasks"],
  stores: ["stores", "devices", "announcements"],
  orders: ["orders", "orderLines"],
  approvals: ["corrections", "approvals"],
  monthly: ["sales"],
  imports: ["imports", "jobs"],
  users: ["users", "roles"],
  audit: ["audit"],
  storeSales: ["sales", "inventory"],
  storeCampaigns: ["campaigns", "campaignItems", "campaignTargets", "campaignTasks"],
  storeOperations: ["sales", "corrections"],
  storeOrders: ["orders", "orderLines"],
  storeNotices: ["notifications"],
};
export async function allRecords(
  resource: Resource,
  options: QueryOptions = {},
): Promise<DataRecord[]> {
  const rows: DataRecord[] = [];
  for (let page = 1; page <= 200; page++) {
    const result = await repository().list(resource, { ...options, page });
    rows.push(...result.rows);
    if (rows.length >= result.total) return rows;
  }
  throw new Error("選択肢が多すぎます。対象店舗の担当範囲を絞ってください。");
}
