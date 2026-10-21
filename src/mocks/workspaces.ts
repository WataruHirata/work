import type { PageId } from "@/config/ui";

export type PreviewRow = {
  id: string;
  name: string;
  store: string;
  date: string;
  value: number;
  status: string;
  detail: string;
};
export type PreviewSpec = {
  columns: [string, string];
  unit: string;
  action?: string;
  nextStatus?: string;
  creatable?: boolean;
  rows: PreviewRow[];
};
const row = (
  id: string,
  name: string,
  value: number,
  status: string,
  detail: string,
  store = "デモ中央店",
): PreviewRow => ({
  id,
  name,
  store,
  date: "2026-10-21",
  value,
  status,
  detail,
});
const sales: PreviewSpec = {
  columns: ["営業日・対象", "売上"],
  unit: "円",
  rows: [
    row(
      "S-001",
      "10/21 日次売上",
      960000,
      "締め前",
      "客数800人 / 客単価1,200円",
    ),
    row(
      "S-002",
      "10/20 日次売上",
      900000,
      "日次確定",
      "客数750人 / 客単価1,200円",
    ),
    row(
      "S-003",
      "10/21 日次売上",
      840000,
      "締め前",
      "客数700人 / 客単価1,200円",
      "デモ南店",
    ),
  ],
};
const orders: PreviewSpec = {
  columns: ["発注商品", "数量"],
  unit: "個",
  action: "発注内容を確認",
  nextStatus: "確認済み（デモ）",
  creatable: true,
  rows: [
    row(
      "O-001",
      "サンプルりんご",
      24,
      "基幹連携待ち",
      "希望納期: 10/23 / 青果売場",
    ),
    row(
      "O-002",
      "サンプル牛乳",
      48,
      "連携エラー",
      "接続先未設定の表示例 / 再送前に内容を確認",
    ),
  ],
};
export const previewSpecs: Partial<Record<PageId, PreviewSpec>> = {
  sales,
  storeSales: {
    ...sales,
    rows: sales.rows.filter((r) => r.store === "デモ中央店"),
  },
  orders,
  storeOrders: {
    ...orders,
    action: "発注を保存",
    nextStatus: "連携待ち（デモ）",
  },
  products: {
    columns: ["商品", "通常売価（参照値）"],
    unit: "円",
    creatable: true,
    rows: [
      row(
        "P-001",
        "サンプルりんご",
        198,
        "有効",
        "商品コード DEMO-001 / 税率8% / 特売対象確認済み",
      ),
      row(
        "P-002",
        "サンプル牛乳",
        238,
        "有効",
        "商品コード DEMO-002 / 税率8% / 特売対象区分は未確認",
      ),
    ],
  },
  approvals: {
    columns: ["修正申請", "修正後金額"],
    unit: "円",
    action: "承認",
    nextStatus: "承認済み（デモ）",
    rows: [
      row(
        "A-001",
        "売上訂正・計上漏れ",
        962000,
        "一次承認待ち",
        "変更前960,000円 / 変更後962,000円 / 理由と差額を確認",
      ),
    ],
  },
  storeOperations: {
    columns: ["対象業務", "対象金額"],
    unit: "円",
    action: "確認を記録",
    nextStatus: "確認済み（デモ）",
    creatable: true,
    rows: [
      row(
        "B-001",
        "当日の売上確認",
        960000,
        "締め前",
        "日次確定前に売上と客数を確認",
      ),
      row(
        "B-002",
        "返品・売上修正の申請",
        1200,
        "申請内容確認",
        "返品理由・対象伝票・操作者の確認が必要",
      ),
    ],
  },
  monthly: {
    columns: ["対象月", "月間売上"],
    unit: "円",
    action: "締め前チェック",
    nextStatus: "チェック済み（デモ）",
    rows: [
      row(
        "M-001",
        "2026年10月",
        24960000,
        "未確定",
        "日次未確定2件 / 修正申請1件 / 月次確定後は修正不可",
      ),
    ],
  },
  stores: {
    columns: ["店舗", "登録端末"],
    unit: "台",
    action: "端末状況を確認",
    nextStatus: "確認済み（デモ）",
    creatable: true,
    rows: [
      row(
        "T-001",
        "デモ中央店",
        2,
        "営業中",
        "開店09:00 / 締め21:00 / 営業日境界04:00",
      ),
      row(
        "T-002",
        "デモ南店",
        1,
        "営業中",
        "開店10:00 / 締め20:00 / 営業日境界04:00",
        "デモ南店",
      ),
    ],
  },
  imports: {
    columns: ["取込・連携処理", "対象件数"],
    unit: "件",
    action: "再処理を試す",
    nextStatus: "再処理待ち（デモ）",
    creatable: true,
    rows: [
      row(
        "I-001",
        "日次売上CSV",
        120,
        "取込完了",
        "受信日時10/21 06:00 / 成功120件",
      ),
      row(
        "I-002",
        "POS価格連携",
        3,
        "連携エラー",
        "外部接続がない場合のエラー表示例",
      ),
    ],
  },
  users: {
    columns: ["利用者（架空）", "権限割当数"],
    unit: "件",
    action: "権限を確認",
    nextStatus: "確認済み（デモ）",
    creatable: true,
    rows: [
      row("U-001", "サンプル店長", 1, "有効", "ロール: 店長 / デモ中央店"),
      row("U-002", "サンプル本部担当", 1, "有効", "ロール: 商品本部 / 本部"),
    ],
  },
  audit: {
    columns: ["監査イベント", "変更件数"],
    unit: "件",
    rows: [
      row(
        "L-001",
        "価格変更指示を発行",
        1,
        "記録済み",
        "架空操作者: 商品本部担当 / 変更内容と対象店舗を記録",
      ),
      row(
        "L-002",
        "店舗が指示を確認",
        1,
        "記録済み",
        "架空操作者: サンプル店長 / 対象: デモ中央店",
      ),
    ],
  },
};

export function filterPreviewRows(
  rows: PreviewRow[],
  search: string,
  store: string,
  status: string,
): PreviewRow[] {
  return rows.filter(
    (r) =>
      (!store || r.store === store) &&
      (!status || r.status === status) &&
      `${r.name} ${r.id} ${r.detail}`.includes(search.trim()),
  );
}
export type DemoInstruction = {
  id: string;
  kind: string;
  title: string;
  product: string;
  price: number;
  effectiveAt: string;
  message: string;
  stores: string[];
  confirmedStores: string[];
};
export const demoStores = ["デモ中央店", "デモ南店", "デモ駅前店"];
export const demoInstructions: DemoInstruction[] = [
  {
    id: "DEMO-N001",
    kind: "価格変更",
    title: "牛乳の売価変更",
    product: "サンプル牛乳",
    price: 218,
    effectiveAt: "2026-10-22T09:00",
    message: "値札と売場表示を確認してください。",
    stores: ["デモ中央店"],
    confirmedStores: [],
  },
];
export function targetInstructions(rows: DemoInstruction[], store: string) {
  return rows.filter((row) => row.stores.includes(store));
}
export function confirmDemoInstruction(
  rows: DemoInstruction[],
  id: string,
  store: string,
) {
  return rows.map((row) =>
    row.id === id &&
    row.stores.includes(store) &&
    !row.confirmedStores.includes(store)
      ? { ...row, confirmedStores: [...row.confirmedStores, store] }
      : row,
  );
}
