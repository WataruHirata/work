import type { CSSProperties } from "react";
import type { Resource } from "@/domain/contracts";

// UI settings only. Business rules and authorization belong to the domain/server.
export const uiConfig = {
  brand: {
    name: "みのり屋",
    subtitle: "SALES OFFICE",
    title: "みのり屋 | 販売管理",
    description: "売上、店舗、商品、運用状況を確認する販売管理システム",
  },
  pages: {
    dashboard: {
      href: "/",
      label: "店舗ポータル",
      title: "みのり屋 店舗ポータル",
      icon: "dashboard",
    },
    storeMenu: {
      href: "/store",
      label: "店舗用共通メニュー",
      title: "店舗の業務を選択",
      icon: "stores",
    },
    storeSales: {
      href: "/store/sales-inventory",
      label: "売上・在庫",
      title: "自店舗 売上・在庫",
      icon: "sales",
    },
    storeOrders: {
      href: "/store/orders",
      label: "発注",
      title: "発注入力・履歴",
      icon: "orders",
    },
    storeOperations: {
      href: "/store/operations",
      label: "店舗業務",
      title: "締め・返品・売上修正",
      icon: "approvals",
    },
    storeCampaigns: {
      href: "/store/campaigns",
      label: "特売・価格",
      title: "特売内容・価格確認",
      icon: "campaigns",
    },
    storeNotices: {
      href: "/store/notices",
      label: "お知らせ",
      title: "お知らせ一覧・詳細",
      icon: "notices",
    },
    admin: {
      href: "/admin",
      label: "管理用共通メニュー",
      title: "管理機能を選択",
      icon: "settings",
    },
    sales: {
      href: "/admin/sales",
      label: "売上管理",
      title: "売上集計・店舗比較",
      icon: "sales",
    },
    products: {
      href: "/admin/products",
      label: "商品管理",
      title: "商品検索・商品編集",
      icon: "products",
    },
    campaigns: {
      href: "/admin/campaigns",
      label: "特売管理",
      title: "特売一覧・特売登録",
      icon: "campaigns",
    },
    orders: {
      href: "/admin/orders",
      label: "発注管理",
      title: "発注状況・発注履歴",
      icon: "orders",
    },
    approvals: {
      href: "/admin/approvals",
      label: "申請・承認",
      title: "申請一覧・承認詳細",
      icon: "approvals",
    },
    monthly: {
      href: "/admin/monthly",
      label: "月次・会計",
      title: "月次締め・会計出力",
      icon: "monthly",
    },
    stores: {
      href: "/admin/stores",
      label: "店舗・端末管理",
      title: "店舗設定・端末管理",
      icon: "stores",
    },
    imports: {
      href: "/admin/imports",
      label: "連携監視",
      title: "連携状況・再処理",
      icon: "imports",
    },
    users: {
      href: "/admin/users",
      label: "利用者・権限管理",
      title: "利用者一覧・権限設定",
      icon: "users",
    },
    audit: {
      href: "/admin/audit",
      label: "監査ログ",
      title: "監査ログ検索・詳細",
      icon: "audit",
    },
    settings: {
      href: "/settings",
      label: "設定",
      title: "表示設定",
      icon: "settings",
    },
    login: {
      href: "/login",
      label: "管理機能ログイン",
      title: "管理機能へログイン",
      icon: "login",
    },
  },
  navigation: ["storeSales", "storeOrders", "storeOperations", "storeCampaigns", "storeNotices"],
  navigationBadges: {
    imports: { label: "3", urgent: false },
    approvals: { label: "2", urgent: true },
  } as Partial<Record<string, { label: string; urgent: boolean }>>,
  colorScheme: "light",
  theme: {
    // Shared visual attributes extracted from the approved UI refresh reference.
    // Legacy names below remain aliases so every existing screen receives the same theme.
    "--text": "#172720",
    "--text-strong": "#0b2f57",
    "--text-subtle": "#68766f",
    "--border": "#e4ebe7",
    "--surface": "#ffffff",
    "--surface-subtle": "#f8fafc",
    "--accent": "#2e75b6",
    "--accent-strong": "#0b2f57",
    "--accent-soft": "#edf3f8",
    "--success": "#2c7a5f",
    "--success-soft": "#ebf7f0",
    "--warning": "#b96c38",
    "--warning-soft": "#fff2e6",
    "--focus": "#2e75b6",
    "--font-size-caption": "13px",
    "--font-size-label": "14px",
    "--font-size-body": "15px",
    "--font-size-emphasis": "17px",
    "--font-size-section-title": "20px",
    "--font-size-page-title": "28px",
    "--space-1": "8px",
    "--space-2": "12px",
    "--space-3": "16px",
    "--space-4": "20px",
    "--space-5": "24px",
    "--space-card": "14px",
    "--space-card-wide": "18px",
    "--radius-control": "8px",
    "--radius-panel": "12px",
    "--radius-pill": "999px",
    "--card-padding": "22px",
    "--control-height": "44px",
    "--disabled-surface": "#e9efec",
    "--ink": "var(--text)",
    "--ink-strong": "var(--text-strong)",
    "--muted": "var(--text-subtle)",
    "--muted-dark": "var(--text-subtle)",
    "--line": "var(--border)",
    "--canvas": "var(--surface-subtle)",
    "--panel": "var(--surface)",
    "--panel-alt": "var(--surface-subtle)",
    "--green": "var(--accent)",
    "--green-dark": "var(--accent-strong)",
    "--green-soft": "var(--accent-soft)",
    "--green-soft-2": "var(--accent-soft)",
    "--green-pale": "var(--surface-subtle)",
    "--sidebar-width": "248px",
    "--sidebar-collapsed-width": "64px",
    "--font-body": '"Yu Gothic UI", "Meiryo", "Hiragino Kaku Gothic ProN", sans-serif',
    "--size-13px": "13px",
    "--size-3px": "3px",
    "--color-83c4aa": "#83c4aa",
    "--size-1px": "1px",
    "--size-negative-1px": "-1px",
    "--size-27px": "27px",
    "--size-16px": "16px",
    "--size-14px": "14px",
    "--color-fff": "#fff",
    "--color-edf1ef": "#edf1ef",
    "--size-11px": "11px",
    "--size-10px": "10px",
    "--size-43px": "43px",
    "--size-39px": "39px",
    "--size-12px": "12px",
    "--color-eaf5ef": "#eaf5ef",
    "--size-2px": "2px",
    "--color-9aa69f": "#9aa69f",
    "--size-9px": "9px",
    "--color-a0aaa5": "#a0aaa5",
    "--size-5px": "5px",
    "--size-8px": "8px",
    "--color-697770": "#697770",
    "--color-f6faf7": "#f6faf7",
    "--color-ebf5ef": "#ebf5ef",
    "--size-negative-16px": "-16px",
    "--size-23px": "23px",
    "--size-19px": "19px",
    "--size-6px": "6px",
    "--color-67746e": "#67746e",
    "--color-b77330": "#b77330",
    "--color-fcf2e4": "#fcf2e4",
    "--color-fbfcfb": "#fbfcfb",
    "--size-31px": "31px",
    "--color-77857e": "#77857e",
    "--color-3aac7c": "#3aac7c",
    "--color-98a49e": "#98a49e",
    "--size-7px": "7px",
    "--size-34px": "34px",
    "--color-778b7e": "#778b7e",
    "--size-4px": "4px",
    "--size-62px": "62px",
    "--color-eaf0ed": "#eaf0ed",
    "--color-mix-1": "rgba(255, 255, 255, 0.94)",
    "--size-20px": "20px",
    "--size-24px": "24px",
    "--size-32px": "32px",
    "--size-28px": "28px",
    "--size-1440px": "1440px",
    "--size-22px": "22px",
    "--size-18px": "18px",
    "--color-mix-2": "rgb(35 66 49 / 2%)",
    "--color-26372d": "#26372d",
    "--color-9aa59f": "#9aa59f",
    "--size-35px": "35px",
    "--color-e4ebe7": "#e4ebe7",
    "--color-54665b": "#54665b",
    "--size-36px": "36px",
    "--color-287c5d": "#287c5d",
    "--size-30px": "30px",
    "--color-a2473b": "#a2473b",
    "--color-506056": "#506056",
    "--size-37px": "37px",
    "--color-26382d": "#26382d",
    "--color-71ad8d": "#71ad8d",
    "--color-mix-3": "rgb(85 157 117 / 12%)",
    "--color-819088": "#819088",
    "--color-edf1ee": "#edf1ee",
    "--color-fafcfb": "#fafcfb",
    "--color-7d8f87": "#7d8f87",
    "--color-1d2f27": "#1d2f27",
    "--color-87958c": "#87958c",
    "--color-3e514c": "#3e514c",
    "--color-edf9f2": "#edf9f2",
    "--color-fff7ef": "#fff7ef",
    "--color-f6faf9": "#f6faf9",
    "--color-314138": "#314138",
    "--color-95a199": "#95a199",
    "--color-72857a": "#72857a",
    "--color-43896b": "#43896b",
    "--color-edf6f0": "#edf6f0",
    "--color-ad783f": "#ad783f",
    "--color-fbf3e8": "#fbf3e8",
    "--color-5f7180": "#5f7180",
    "--color-edf3f8": "#edf3f8",
    "--size-41px": "41px",
    "--color-51615b": "#51615b",
    "--size-999px": "999px",
    "--color-dfe8e3": "#dfe8e3",
    "--color-mix-4": "rgba(26, 45, 37, 0.2)",
    "--color-3b8d69": "#3b8d69",
    "--color-ebf0ee": "#ebf0ee",
    "--color-6d7d73": "#6d7d73",
    "--color-98a39c": "#98a39c",
    "--size-46px": "46px",
    "--color-f0f3f1": "#f0f3f1",
    "--color-76847b": "#76847b",
    "--color-b85f50": "#b85f50",
    "--size-42px": "42px",
    "--color-f8fcfa": "#f8fcfa",
    "--color-466556": "#466556",
    "--size-52px": "52px",
    "--color-dff1e8": "#dff1e8",
    "--color-246a50": "#246a50",
    "--color-b5c4bc": "#b5c4bc",
    "--color-1b2d27": "#1b2d27",
    "--size-26px": "26px",
    "--color-2d8b6b": "#2d8b6b",
    "--color-6f8078": "#6f8078",
    "--size-168px": "168px",
    "--size-38px": "38px",
    "--color-e8efeb": "#e8efeb",
    "--color-3d534b": "#3d534b",
    "--color-213b31": "#213b31",
    "--color-72857d": "#72857d",
    "--color-32463d": "#32463d",
    "--size-214px": "214px",
    "--color-mix-5": "rgba(15, 34, 22, 0.02)",
    "--color-566b62": "#566b62",
    "--color-eaf7f0": "#eaf7f0",
    "--color-2d8c68": "#2d8c68",
    "--color-ebf3ff": "#ebf3ff",
    "--color-3866d1": "#3866d1",
    "--color-f1eefc": "#f1eefc",
    "--color-6857ba": "#6857ba",
    "--color-fff2dc": "#fff2dc",
    "--color-c98f2d": "#c98f2d",
    "--color-7b8b82": "#7b8b82",
    "--color-7a8b84": "#7a8b84",
    "--color-50615c": "#50615c",
    "--color-2b8f70": "#2b8f70",
    "--color-d26b52": "#d26b52",
    "--size-54px": "54px",
    "--color-a9d7c1": "#a9d7c1",
    "--color-6d7c76": "#6d7c76",
    "--color-9bb4a6": "#9bb4a6",
    "--color-56b889": "#56b889",
    "--size-280px": "280px",
    "--color-1f352f": "#1f352f",
    "--color-86968e": "#86968e",
    "--color-f7faf8": "#f7faf8",
    "--size-74px": "74px",
    "--color-5d6a64": "#5d6a64",
    "--color-215941": "#215941",
    "--color-mix-6": "rgb(23 80 59 / 10%)",
    "--color-1d312b": "#1d312b",
    "--color-7d8e87": "#7d8e87",
    "--size-242px": "242px",
    "--color-98a6a0": "#98a6a0",
    "--size-230px": "230px",
    "--color-8d9b95": "#8d9b95",
    "--color-617268": "#617268",
    "--color-8a9a93": "#8a9a93",
    "--size-25px": "25px",
    "--color-ebf6f0": "#ebf6f0",
    "--color-317e63": "#317e63",
    "--size-66px": "66px",
    "--color-fff0ea": "#fff0ea",
    "--color-d4754b": "#d4754b",
    "--color-eef5ff": "#eef5ff",
    "--color-4f73ca": "#4f73ca",
    "--color-edf5ef": "#edf5ef",
    "--color-20352f": "#20352f",
    "--color-7d8e88": "#7d8e88",
    "--color-fbe7d9": "#fbe7d9",
    "--color-c26b3d": "#c26b3d",
    "--color-2c705b": "#2c705b",
    "--color-607067": "#607067",
    "--color-6dbf9b": "#6dbf9b",
    "--color-73857d": "#73857d",
    "--size-640px": "640px",
    "--color-2f403b": "#2f403b",
    "--color-2a8a68": "#2a8a68",
    "--color-67796e": "#67796e",
    "--color-ebf7f0": "#ebf7f0",
    "--color-2c7a5f": "#2c7a5f",
    "--color-3eb67a": "#3eb67a",
    "--color-fff2e6": "#fff2e6",
    "--color-b96c38": "#b96c38",
    "--color-d27f43": "#d27f43",
    "--color-50615a": "#50615a",
    "--color-7a8a84": "#7a8a84",
    "--color-7d8c86": "#7d8c86",
    "--color-c3cdc8": "#c3cdc8",
    "--color-2d705d": "#2d705d",
    "--size-15px": "15px",
    "--motion-duration": "180ms",
    "--motion-easing": "ease",
    "--motion-stagger": "45ms",
  },
} as const;

export type PageId = keyof typeof uiConfig.pages;
export const themeStyle: CSSProperties & Record<`--${string}`, string> = {
  ...uiConfig.theme,
  colorScheme: uiConfig.colorScheme,
};

// CSS custom properties cannot be used in media query conditions.
// Keep responsive thresholds and reduced motion policy in this same settings file.
export const responsiveStyles = `@media (max-width: 1180px) {
  .page-grid,
  .page-panel {
    width: min(100%, calc(100% - var(--size-28px)));
  }
  .page-grid.double {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 700px) {
  .global-shell:has(.admin-notification-toolbar) {
    flex-direction: column;
  }
  .global-shell:has(.admin-notification-toolbar) > .global-sidebar {
    order: 1;
    position: static;
    width: 100%;
    height: auto;
    flex-basis: auto;
  }
  .global-shell:has(.admin-notification-toolbar) > .global-main {
    width: 100%;
  }
  .admin-menu-panel .admin-menu-grid {
    grid-template-columns: 1fr;
  }
  .global-shell:has(.admin-notification-toolbar) .page-topbar {
    height: auto;
    min-height: var(--size-54px);
    flex-wrap: wrap;
    gap: var(--space-2);
    padding-block: var(--space-3);
  }
  .page-grid,
  .page-grid.double,
  .stat-row,
  .list-card {
    grid-template-columns: 1fr;
  }
  .ui-actions,
  .button-row {
    align-items: stretch;
    flex-direction: column;
  }
  .ui-actions > *,
  .button-row > .primary-button,
  .button-row > .ghost-button,
  .button-row > .danger-button,
  .ui-button,
  .ui-button-primary,
  .ui-button-secondary {
    width: 100%;
  }
}
@media (max-width: 560px) {
  .page-topbar {
    height: var(--size-54px);
    padding: 0 var(--size-16px);
  }
  .page-topbar h1 {
    font-size: var(--size-22px);
  }
  .page-shell .page-panel,
  .page-shell .page-grid {
    width: min(100%, calc(100% - var(--size-20px)));
  }
  .page-panel {
    margin-top: var(--size-16px);
    padding: var(--size-15px) var(--size-13px) var(--size-13px);
  }
  .panel-head {
    align-items: flex-start;
    flex-direction: column;
  }
  .panel-head > .segmented-control {
    width: 100%;
  }
  .page-grid {
    grid-template-columns: 1fr;
    width: min(100%, calc(100% - var(--size-20px)));
    margin-top: var(--size-16px);
  }
  .stat-row {
    grid-template-columns: 1fr;
  }
  .list-card {
    grid-template-columns: 1fr;
    align-items: flex-start;
  }
  .button-row {
    justify-content: flex-start;
  }
}
@media (max-width: 1180px) {
  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 920px) {
  .dashboard-page .content {
    width: min(100%, calc(100% - var(--size-24px)));
  }
}
@media (max-width: 560px) {
  .dashboard-page .content {
    width: min(100%, calc(100% - var(--size-20px)));
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .page-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .heading-controls {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }

  .select-wrap,
  .date-button {
    width: 100%;
  }

  .demo-banner {
    align-items: flex-start;
    padding: var(--size-10px) var(--size-12px);
  }

  .footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}`;

export type WorkspaceField = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "password" | "email";
  required?: boolean;
  options?: readonly { value: string; label: string }[];
  lookup?: Resource;
  min?: number;
  max?: number;
};
export const roleOptions = [
  { value: "information_systems", label: "情報システム部" },
  { value: "product_office", label: "商品本部" },
  { value: "store_operations", label: "店舗運営本部" },
  { value: "area_manager", label: "エリアマネージャー" },
  { value: "accounting", label: "経理" },
  { value: "store_manager", label: "店長" },
  { value: "department_lead", label: "売場主任" },
  { value: "staff", label: "一般社員" },
] as const;
const booleanOptions = [
  { value: "true", label: "有効" },
  { value: "false", label: "無効" },
];
export const masterFields: Partial<Record<Resource, readonly WorkspaceField[]>> = {
  products: [
    { key: "code", label: "商品コード", required: true },
    { key: "name", label: "商品名", required: true },
    { key: "category_code", label: "分類コード" },
    {
      key: "tax_rate",
      label: "税率",
      required: true,
      options: [
        { value: "8", label: "8%" },
        { value: "10", label: "10%" },
      ],
    },
    {
      key: "active",
      label: "利用状態",
      options: booleanOptions,
      required: true,
    },
  ],
  stores: [
    { key: "code", label: "店舗コード", required: true },
    { key: "name", label: "店舗名", required: true },
    { key: "area_id", label: "エリア", lookup: "areas", required: true },
    { key: "opening_time", label: "開店時刻", type: "time", required: true },
    { key: "closing_time", label: "締め時刻", type: "time", required: true },
    {
      key: "business_day_starts_at",
      label: "営業日境界",
      type: "time",
      required: true,
    },
    {
      key: "status",
      label: "店舗状態",
      required: true,
      options: [
        { value: "active", label: "営業中" },
        { value: "temporarily_closed", label: "休業中" },
        { value: "closed", label: "閉店" },
      ],
    },
    {
      key: "has_dine_in",
      label: "イートイン設備",
      required: true,
      options: [
        { value: "true", label: "あり" },
        { value: "false", label: "なし" },
      ],
    },
    { key: "opened_on", label: "開店日", type: "date" },
  ],
  users: [
    { key: "employee_code", label: "社員番号", required: true },
    { key: "display_name", label: "氏名", required: true },
    { key: "affiliation", label: "所属" },
    {
      key: "active",
      label: "利用状態",
      options: booleanOptions,
      required: true,
    },
  ],
  announcements: [
    { key: "store_id", label: "対象店舗", lookup: "stores", required: true },
    { key: "title", label: "件名", required: true },
    { key: "message", label: "本文", required: true },
  ],
};
export const resourceLabels: Record<Resource, string> = {
  instructions: "本部変更指示",
  instructionTargets: "通知対象・店舗確認",
  products: "商品",
  stores: "店舗",
  areas: "エリア",
  departments: "売場",
  sales: "営業日別売上",
  corrections: "修正申請",
  approvals: "承認履歴",
  orders: "発注履歴",
  orderLines: "発注明細",
  inventory: "在庫（基幹連携値）",
  notifications: "個人宛通知",
  announcements: "店舗お知らせ",
  users: "利用者",
  roles: "権限割当",
  audit: "監査ログ",
  imports: "売上取込履歴",
  jobs: "外部連携・再処理",
  devices: "店舗端末",
  prices: "通常売価（既存マスタ参照）",
  campaigns: "特売",
  campaignItems: "特売商品",
  campaignTargets: "特売対象店舗",
  campaignTasks: "特売作業",
};
export const columnLabels: Record<string, string> = {
  id: "ID",
  code: "コード",
  name: "名称",
  category_code: "分類",
  tax_rate: "税率",
  active: "有効",
  promotion_eligibility: "特売対象区分",
  updated_at: "更新日時",
  store_id: "店舗",
  area_id: "エリア",
  department_id: "売場",
  product_id: "商品",
  user_id: "利用者",
  requested_by: "申請者",
  opening_time: "開店",
  closing_time: "締め",
  business_day_starts_at: "営業日境界",
  has_dine_in: "イートイン",
  opened_on: "開店日",
  status: "状態",
  business_date: "営業日",
  net_sales_yen: "売上（円）",
  gross_sales_yen: "総売上（円）",
  customer_count: "客数",
  transaction_count: "取引数",
  sales_day_id: "対象売上",
  reason: "修正理由",
  before_amount_yen: "変更前（円）",
  after_amount_yen: "変更後（円）",
  requested_at: "申請日時",
  correction_id: "修正申請",
  approval_stage: "承認段階",
  approved: "承認",
  comment: "コメント",
  acted_at: "実行日時",
  order_id: "発注",
  order_date: "発注日",
  requested_delivery_date: "希望納期",
  quantity: "数量",
  observed_at: "在庫取得日時",
  source_reference: "連携元",
  title: "件名",
  message: "内容",
  notification_type: "種別",
  read_at: "既読日時",
  created_at: "登録日時",
  employee_code: "社員番号",
  display_name: "氏名",
  affiliation: "所属",
  must_change_password: "初回変更待ち",
  role: "ロール",
  table_name: "対象",
  record_id: "対象ID",
  operation: "操作",
  actor_id: "操作者",
  occurred_at: "日時",
  before_data: "変更前",
  after_data: "変更後",
  source_file_name: "ファイル名",
  source_checksum: "重複判定値",
  rows_received: "受信行数",
  error_summary: "エラー",
  received_at: "受信日時",
  kind: "連携種別",
  idempotency_key: "処理識別子",
  attempts: "実行回数",
  last_error: "エラー",
  available_at: "次回処理日時",
  price_yen: "価格（円）",
  valid_from: "適用開始",
  valid_until: "適用終了",
};
export const stateLabels: Record<string, string> = {
  active: "営業中",
  temporarily_closed: "休業中",
  closed: "閉店",
  imported: "締め前",
  confirmed: "日次確定",
  monthly_finalized: "月次確定",
  pending_area_approval: "エリア承認待ち",
  pending_operations_approval: "本部承認待ち",
  approved: "承認済み",
  rejected: "差戻し",
  cancelled: "取消",
  draft: "下書き",
  submitted: "送信待ち",
  sent: "送信済み",
  failed: "失敗",
  pending: "待機",
  processing: "処理中",
  completed: "完了",
  received: "受信済み",
  eligible: "対象確認済み",
  excluded: "対象外",
  not_configured: "未確認",
  order: "基幹発注",
  campaign_price: "POS特売適用",
  campaign_restore: "POS通常売価復帰",
  sales_import: "売上取込",
  area: "一次",
  operations: "最終",
  same_day: "当日修正",
};

export type StateTone = "neutral" | "warning" | "success";

const successStates = new Set([
  "active",
  "approved",
  "applied",
  "completed",
  "confirmed",
  "eligible",
  "manual_confirmed",
  "monthly_finalized",
  "restored",
  "sent",
]);
const warningStates = new Set([
  "cancelled",
  "closed",
  "excluded",
  "failed",
  "not_configured",
  "pending",
  "pending_area",
  "pending_area_approval",
  "pending_operations",
  "pending_operations_approval",
  "processing",
  "received",
  "rejected",
  "submitted",
  "temporarily_closed",
]);

export function stateTone(state: string): StateTone {
  if (successStates.has(state)) return "success";
  if (warningStates.has(state)) return "warning";
  return "neutral";
}
