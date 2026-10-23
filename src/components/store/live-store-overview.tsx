"use client";

import { Activity, ShoppingBasket, TrendingUp, Wallet } from "@/components/ui/icons";
import Link from "next/link";
import { storeSummary } from "@/domain/store-summary";
import type { Json } from "@/domain/contracts";
import { CollapsibleTable } from "@/components/ui/collapsible-table";
import { uiConfig } from "@/config/ui";
import { SalesCompositionChart } from "@/components/store/sales-composition-chart";
import { SalesTrendChart } from "@/components/store/sales-trend-chart";
export function LiveStoreOverview({ snapshot }: { snapshot: Record<string, Json> }) {
  const summary = storeSummary(snapshot);
  const yen = (value: number) => `¥${Math.round(value).toLocaleString("ja-JP")}`;
  const rawSalesComposition = Array.isArray(snapshot.salesComposition)
    ? snapshot.salesComposition
    : Array.isArray(snapshot.departments)
      ? snapshot.departments
      : [];
  const salesComposition = rawSalesComposition.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const name = String(item.name ?? "").trim();
    const sales = Number(item.sales);
    return name && Number.isSafeInteger(sales) && sales > 0 ? [{ name, sales }] : [];
  });
  const compositionTotal = salesComposition.reduce((total, item) => total + item.sales, 0);
  const showSalesComposition =
    Boolean(summary.latest && summary.latest.sales > 0) &&
    salesComposition.length > 0 &&
    compositionTotal === summary.latest?.sales;
  return (
    <div className="content">
      <div className="store-overview-grid">
        <div className="store-overview-sidebar">
          <section className="metrics-grid portal-metrics-grid" aria-label="接続店舗の営業指標">
            <Link
              className="metric-card metric-card-link store-sales-composition-card"
              href={uiConfig.pages.storeSales.href}
            >
              <div className="store-sales-summary">
                <div className="metric-topline">
                  <span>直近営業日の売上</span>
                  <span className="metric-icon green-icon">
                    <TrendingUp size={18} aria-hidden="true" />
                  </span>
                </div>
                <div className="metric-value">
                  <strong>{summary.latest ? yen(summary.latest.sales) : "—"}</strong>
                </div>
                <p className="metric-foot">
                  {summary.latest
                    ? `${summary.latest.date} · ${summary.change === null ? "比較対象なし" : `前営業日比 ${summary.change.toFixed(1)}%`}`
                    : "売上データなし"}
                </p>
              </div>
              {showSalesComposition ? (
                <SalesCompositionChart
                  items={salesComposition}
                  total={compositionTotal}
                  formatValue={yen}
                />
              ) : null}
            </Link>
            <div className="store-compact-metrics">
              {[
                {
                  label: "在庫アラート件数",
                  value:
                    summary.inventoryAlertCount === null ? "—" : `${summary.inventoryAlertCount}件`,
                  note: "在庫数量0以下",
                  Icon: Activity,
                  href: uiConfig.pages.storeInventory.href,
                },
                {
                  label: "お知らせ件数",
                  value: summary.noticeCount === null ? "—" : `${summary.noticeCount}件`,
                  note: "登録店舗のお知らせ",
                  Icon: Wallet,
                  href: uiConfig.pages.storeNotices.href,
                },
                {
                  label: "特売未対応件数",
                  value:
                    summary.campaignPendingCount === null
                      ? "—"
                      : `${summary.campaignPendingCount}件`,
                  note: "売場作業待ちの特売",
                  Icon: ShoppingBasket,
                  href: uiConfig.pages.storeCampaigns.href,
                },
              ].map(({ label, value, note, Icon, href }) => (
                <Link className="metric-card metric-card-link" href={href} key={label}>
                  <div className="metric-topline">
                    <span>{label}</span>
                    <span className="metric-icon green-icon">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                  </div>
                  <div className="metric-value">
                    <strong>{value}</strong>
                  </div>
                  <p className="metric-foot">{note}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>
        <section className="panel sales-panel store-sales-trend-panel">
          <h2 className="panel-title">店舗売上の推移</h2>
          {summary.days.length ? (
            <>
              <SalesTrendChart days={summary.days} formatValue={yen} />
              <CollapsibleTable
                scrollAllRows
                containerClassName="table-scroll store-sales-table-scroll"
                caption="DBに保存された営業日別データ（税込・円）"
                head={
                  <tr>
                    <th scope="col">営業日</th>
                    <th scope="col">売上</th>
                    <th scope="col">客数</th>
                  </tr>
                }
              >
                {summary.days.map((day) => (
                  <tr key={day.date}>
                    <th scope="row">{day.date}</th>
                    <td>{yen(day.sales)}</td>
                    <td>{day.customers}</td>
                  </tr>
                ))}
              </CollapsibleTable>
            </>
          ) : (
            <p>まだ売上データが取り込まれていません。</p>
          )}
        </section>
      </div>
    </div>
  );
}
