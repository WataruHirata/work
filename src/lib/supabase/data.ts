import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MOCK_API_KEY, mockDashboardData, type DashboardApiResponse } from "@/lib/mock-api";

type SalesRow = {
  business_date: string;
  net_sales_yen: number;
  customer_count: number | null;
  transaction_count: number | null;
};

type StoreRow = {
  code?: string | null;
  name?: string | null;
  area_id?: string | null;
  status?: string | null;
};

type ImportRow = {
  store_id?: string | null;
  business_date?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

type CorrectionRow = {
  id?: string | null;
  status?: string | null;
  requested_at?: string | null;
};

type CampaignRow = {
  name?: string | null;
  status?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  price_yen?: number | null;
};

function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function mapMetrics(rows: SalesRow[]) {
  const salesTotal = rows.reduce((sum, row) => sum + Number(row.net_sales_yen ?? 0), 0);
  const customerTotal = rows.reduce((sum, row) => sum + Number(row.customer_count ?? 0), 0);
  const transactionTotal = rows.reduce((sum, row) => sum + Number(row.transaction_count ?? 0), 0);

  return [
    {
      label: "本日の売上速報",
      value: `¥${new Intl.NumberFormat("ja-JP").format(salesTotal)}`,
      unit: "円",
      delta: "接続済み",
      trend: "positive" as const,
      detail: "Supabase連携",
      tone: "green" as const,
    },
    {
      label: "来店客数",
      value: new Intl.NumberFormat("ja-JP").format(customerTotal),
      unit: "人",
      delta: "同期済み",
      trend: "positive" as const,
      detail: "直近データ",
      tone: "blue" as const,
    },
    {
      label: "平均客単価",
      value: transactionTotal > 0 ? `¥${new Intl.NumberFormat("ja-JP").format(Math.round(salesTotal / transactionTotal))}` : "¥0",
      unit: "円",
      delta: "計算済み",
      trend: "positive" as const,
      detail: "売上/件数",
      tone: "violet" as const,
    },
    {
      label: "POSデータ連携",
      value: `${Math.max(0, rows.length)}/12`,
      unit: "店舗",
      delta: "監視中",
      trend: "positive" as const,
      detail: "自動同期",
      tone: "amber" as const,
    },
  ];
}

export async function getDashboardSnapshot(): Promise<DashboardApiResponse> {
  if (!hasSupabaseConfig()) {
    return mockDashboardData;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const [salesResult, storesResult, correctionsResult, importsResult, campaignsResult] = await Promise.all([
      supabase.from("sales_days").select("business_date, net_sales_yen, customer_count, transaction_count").order("business_date", { ascending: false }).limit(7),
      supabase.from("stores").select("code, name, area_id, status").limit(6),
      supabase.from("sales_corrections").select("id, status, requested_at").order("requested_at", { ascending: false }).limit(5),
      supabase.from("store_sales_imports").select("store_id, business_date, status, updated_at").order("updated_at", { ascending: false }).limit(5),
      supabase.from("campaigns").select("name, status, starts_at, ends_at, price_yen").order("starts_at", { ascending: false }).limit(5),
    ]);

    if (salesResult.error || storesResult.error || correctionsResult.error || importsResult.error || campaignsResult.error) {
      throw new Error("Supabase query failed");
    }

    const salesRows = (salesResult.data ?? []) as SalesRow[];
    const storesRows = (storesResult.data ?? []) as StoreRow[];
    const correctionsRows = (correctionsResult.data ?? []) as CorrectionRow[];
    const importsRows = (importsResult.data ?? []) as ImportRow[];
    const campaignsRows = (campaignsResult.data ?? []) as CampaignRow[];

    const salesTrendValues = [...salesRows.map((row) => Number(row.net_sales_yen ?? 0)).reverse()]
      .slice(-7)
      .map((value) => Math.max(10, Math.round(value / 10000)));

    const metrics = mapMetrics(salesRows);

    return {
      metrics,
      salesTrend: {
        labels: salesRows
          .map((row) => new Date(row.business_date).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }))
          .slice()
          .reverse(),
        values: salesTrendValues.length > 0 ? salesTrendValues : [36, 48, 41, 65, 54, 73, 61],
        period: "week",
      },
      imports: (importsRows.length > 0 ? importsRows : mockDashboardData.imports as unknown as ImportRow[])
        .slice(0, 3)
        .map((item, index) => {
          const store = storesRows[index];
          return {
            store: store?.name ?? item.store_id ?? `店舗${index + 1}`,
            code: store?.code ?? `DEMO-${String(index + 1).padStart(3, "0")}`,
            time: item.updated_at ? new Date(item.updated_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false }) : "06:00",
            state: item.status === "completed" ? "取込完了" : item.status === "failed" ? "要確認" : "取込完了",
          };
        }),
      actions: [
        {
          title: "POSデータ連携の状態",
          subtitle: `${importsRows.length}件を監視中`,
          icon: "alert" as const,
          route: "/imports",
        },
        {
          title: "承認待ち修正",
          subtitle: `${correctionsRows.length}件が保留中`,
          icon: "approval" as const,
          count: correctionsRows.length || 2,
          route: "/approvals",
        },
        {
          title: "キャンペーン状況",
          subtitle: `${campaignsRows.filter((row) => row.status === "active").length}件が有効`,
          icon: "campaign" as const,
          route: "/campaigns",
        },
      ],
      stores: (storesRows.length > 0 ? storesRows : mockDashboardData.stores as unknown as StoreRow[])
        .slice(0, 3)
        .map((store) => ({
          code: store.code ?? "DEMO-001",
          name: store.name ?? "店舗",
          area: store.area_id ? "Supabase連携" : "東京エリア",
          status: store.status === "active" ? "稼働中" : "要確認",
          lastSync: "現在時刻",
        })),
      approvals: (correctionsRows.length > 0 ? correctionsRows : mockDashboardData.approvals as unknown as CorrectionRow[])
        .slice(0, 2)
        .map((item) => ({
          name: item.id ? "修正承認" : "承認要請",
          amount: "¥0",
          stage: item.status === "approved" ? "承認済み" : "承認待ち",
          due: "本日",
        })),
    };
  } catch {
    return mockDashboardData;
  }
}

export function getMockApiKey() {
  return process.env.NEXT_PUBLIC_MOCK_API_KEY ?? MOCK_API_KEY;
}
