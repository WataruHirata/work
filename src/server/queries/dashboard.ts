import "server-only";
import { repository } from "@/server/container";
import { allRecords } from "@/server/queries/workspaces";
import type { DashboardApiResponse } from "@/domain/dashboard";
export function getMockApiKey() {
  return process.env.NEXT_PUBLIC_MOCK_API_KEY ?? "";
}
export async function getDashboardSnapshot(): Promise<DashboardApiResponse> {
  const from = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
  const [sales, stores, corrections, campaigns] = await Promise.all([
    allRecords("sales", { from }),
    allRecords("stores"),
    (await repository().list("corrections")).rows,
    (await repository().list("campaigns")).rows,
  ]);
  const latest = sales
    .map((row) => String(row.business_date))
    .sort()
    .at(-1);
  const current = sales.filter((row) => row.business_date === latest);
  const total = current.reduce(
    (sum, row) => sum + Number(row.net_sales_yen),
    0,
  );
  const customers = current.reduce(
    (sum, row) => sum + Number(row.customer_count),
    0,
  );
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(customers))
    throw new Error("集計値が表示可能な範囲を超えています。");
  const pending = corrections.filter((row) =>
    String(row.status).startsWith("pending_"),
  );
  const byDate = new Map<string, number>();
  for (const row of sales)
    byDate.set(
      String(row.business_date),
      (byDate.get(String(row.business_date)) ?? 0) + Number(row.net_sales_yen),
    );
  const series = [...byDate].sort(([a], [b]) => a.localeCompare(b)).slice(-7);
  return {
    metrics: [
      {
        label: "直近営業日の売上",
        value: total.toLocaleString("ja-JP"),
        unit: "円",
        delta: latest ?? "データなし",
        trend: "positive",
        detail: "権限範囲内の合計",
        tone: "green",
      },
      {
        label: "客数",
        value: customers.toLocaleString("ja-JP"),
        unit: "人",
        delta: latest ?? "",
        trend: "positive",
        detail: "同営業日",
        tone: "blue",
      },
      {
        label: "客単価",
        value: customers
          ? Math.round(total / customers).toLocaleString("ja-JP")
          : "0",
        unit: "円",
        delta: "",
        trend: "positive",
        detail: "売上 ÷ 客数",
        tone: "violet",
      },
      {
        label: "参照対象店舗",
        value: String(stores.length),
        unit: "店舗",
        delta: "",
        trend: "positive",
        detail: "ロール・担当範囲",
        tone: "amber",
      },
    ],
    salesTrend: {
      labels: series.map(([day]) => day),
      values: series.map(([, value]) => value),
      period: "week",
    },
    imports: [],
    actions: [
      {
        title: "承認待ち",
        subtitle: `${pending.length}件`,
        count: pending.length,
        icon: "approval",
        route: "/admin/approvals",
      },
      {
        title: "特売",
        subtitle: `${campaigns.length}件`,
        icon: "campaign",
        route: "/admin/campaigns",
      },
    ],
    stores: stores.map((row) => ({
      code: String(row.code),
      name: String(row.name),
      area: String(row.area_id),
      status: String(row.status),
      lastSync: String(row.updated_at),
    })),
    approvals: pending.map((row) => ({
      ...row,
      name: String(row.reason),
      amount: String(row.after_amount_yen),
      stage: String(row.status),
      due: String(row.requested_at),
    })),
  };
}
