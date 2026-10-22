import type { DashboardApiResponse } from "@/domain/dashboard";

export const MOCK_API_KEY = process.env.NEXT_PUBLIC_MOCK_API_KEY ?? "minoriya-demo-key";

export const mockDashboardData: DashboardApiResponse = {
  metrics: [
    {
      label: "本日の売上速報",
      value: "8,426,580",
      unit: "円",
      delta: "8.2%",
      trend: "positive",
      detail: "前週同曜日比",
      tone: "green",
    },
    {
      label: "来店客数",
      value: "4,218",
      unit: "人",
      delta: "3.6%",
      trend: "positive",
      detail: "前週同曜日比",
      tone: "blue",
    },
    {
      label: "平均客単価",
      value: "1,998",
      unit: "円",
      delta: "1.2%",
      trend: "negative",
      detail: "前週同曜日比",
      tone: "violet",
    },
    {
      label: "POSデータ連携",
      value: "109/112",
      unit: "店舗",
      delta: "97.3%",
      trend: "positive",
      detail: "3店舗の確認が必要",
      tone: "amber",
    },
  ],
  salesTrend: {
    labels: ["10/15", "10/16", "10/17", "10/18", "10/19", "10/20", "10/21"],
    values: [36, 48, 41, 65, 54, 73, 61],
    period: "week",
  },
  imports: [
    {
      store: "デモ店舗・標準",
      code: "DEMO-001",
      time: "06:14",
      state: "取込完了",
    },
    {
      store: "デモ店舗・24時間",
      code: "DEMO-002",
      time: "06:12",
      state: "取込完了",
    },
    {
      store: "デモ店舗・モール",
      code: "DEMO-003",
      time: "06:09",
      state: "要確認",
    },
  ],
  actions: [
    {
      title: "POSデータ未連携",
      subtitle: "3店舗 · 最終確認 06:30",
      icon: "alert",
      route: "/imports",
    },
    {
      title: "売上修正の承認待ち",
      subtitle: "2件 · エリアマネージャー",
      icon: "approval",
      count: 2,
      route: "/approvals",
    },
    {
      title: "特売の終了予定",
      subtitle: "本日 18:00 · 8商品",
      icon: "campaign",
      route: "/campaigns",
    },
  ],
  stores: [
    {
      code: "DEMO-001",
      name: "デモ店舗・標準",
      area: "東京エリア",
      status: "稼働中",
      lastSync: "06:14",
    },
    {
      code: "DEMO-002",
      name: "デモ店舗・24時間",
      area: "関西エリア",
      status: "稼働中",
      lastSync: "06:12",
    },
    {
      code: "DEMO-003",
      name: "デモ店舗・モール",
      area: "福岡エリア",
      status: "要確認",
      lastSync: "06:09",
    },
  ],
  approvals: [
    {
      name: "売上修正承認",
      amount: "¥72,000",
      stage: "エリア承認待ち",
      due: "09:10",
    },
    {
      name: "価格変更承認",
      amount: "¥31,500",
      stage: "本部承認待ち",
      due: "12:10",
    },
  ],
};
