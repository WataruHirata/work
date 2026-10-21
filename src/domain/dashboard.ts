export type DashboardMetric = {
  label: string;
  value: string;
  unit?: string;
  delta: string;
  trend: "positive" | "negative";
  detail: string;
  tone: "green" | "blue" | "violet" | "amber";
};

export type DashboardImportItem = {
  store: string;
  code: string;
  time: string;
  state: "取込完了" | "要確認";
};

export type DashboardActionItem = {
  title: string;
  subtitle: string;
  count?: number;
  icon: "alert" | "approval" | "campaign";
  route: string;
};

export type DashboardApiResponse = {
  metrics: DashboardMetric[];
  salesTrend: {
    labels: string[];
    values: number[];
    period: "week" | "month";
  };
  imports: DashboardImportItem[];
  actions: DashboardActionItem[];
  stores: Array<{
    code: string;
    name: string;
    area: string;
    status: string;
    lastSync: string;
  }>;
  approvals: Array<{
    name: string;
    amount: string;
    stage: string;
    due: string;
  }>;
};
