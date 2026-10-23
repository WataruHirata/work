import { loadSalesReport, type SalesSearch } from "@/server/queries/sales-report";
import Link from "next/link";
import { PageLayout } from "@/components/ui/page-layout";
import { FeatureNotice } from "@/components/ui/feature-notice";
import { StateBadge } from "@/components/ui/state-badge";
import { PreviewWorkspace } from "@/components/preview/preview-workspace";
import { uiConfig, stateLabels } from "@/config/ui";
import { requireAdminFeature } from "@/server/auth/admin-access";
import { backendConfigured } from "@/server/container";
import { averageSale } from "@/domain/sales-report";
import { Activity, ShoppingBasket, TrendingUp, Wallet } from "@/components/ui/icons";

export type { SalesSearch } from "@/server/queries/sales-report";
const number = (value: bigint) => value.toLocaleString("ja-JP");
const yen = (value: bigint) => `¥${number(value)}`;
const average = (net: bigint, customers: bigint) => {
  const value = averageSale(net, customers);
  return value === null ? "—" : yen(value);
};

export async function SalesWorkspace({ search }: { search: SalesSearch }) {
  await requireAdminFeature("sales");
  if (!backendConfigured()) return <PreviewWorkspace feature="sales" />;
  let report: Awaited<ReturnType<typeof loadSalesReport>>;
  try {
    report = await loadSalesReport(search);
  } catch (error) {
    return (
      <PageLayout page="sales">
        <FeatureNotice title="売上を表示できませんでした">
          {error instanceof Error ? error.message : "時間をおいて再度お試しください。"}
          <p>
            <Link className="ghost-button" href={uiConfig.pages.sales.href}>
              条件をクリアして再表示
            </Link>
          </p>
        </FeatureNotice>
      </PageLayout>
    );
  }
  return <SalesReportView search={search} report={report} />;
}

function SalesReportView({
  search,
  report,
}: {
  search: SalesSearch;
  report: Awaited<ReturnType<typeof loadSalesReport>>;
}) {
  const {
    from,
    to,
    storeId,
    areaId,
    stores,
    areas,
    targetStores,
    rows,
    totals,
    byStore,
    byDate,
    pageCount,
    page,
    pageHref,
    storeName,
  } = report;
  const chartRows = byDate.filter((row) => row.net >= 0n);
  const chartMax = chartRows.reduce((value, row) => (row.net > value ? row.net : value), 1n);
  const chartX = (index: number) =>
    chartRows.length > 1 ? 48 + (index * 604) / (chartRows.length - 1) : 350;
  const chartY = (value: bigint) => 244 - Number((value * 186000n) / chartMax) / 1000;
  const chartPoints = chartRows
    .map((row, index) => `${chartX(index)},${chartY(row.net)}`)
    .join(" ");
  const chartArea = chartRows.length
    ? `M ${chartPoints.replaceAll(" ", " L ")} L ${chartX(chartRows.length - 1)},244 L ${chartX(0)},244 Z`
    : "";
  const storeMax = byStore.reduce((value, row) => (row.net > value ? row.net : value), 1n);
  return (
    <PageLayout page="sales">
      <div className="admin-sales-dashboard">
        <section className="page-panel admin-sales-filter-panel">
          <h2>表示条件</h2>
          <form method="get" className="sales-filter">
            <label className="field">
              <span>エリア</span>
              <select aria-label="エリア" name="area" defaultValue={areaId ?? ""}>
                <option value="">担当範囲の全エリア</option>
                {areas
                  .filter((area) => stores.some((store) => store.area_id === area.id))
                  .map((area) => (
                    <option key={area.id} value={area.id}>
                      {String(area.name)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>店舗</span>
              <select aria-label="店舗" name="store" defaultValue={storeId ?? ""}>
                <option value="">担当範囲の全店舗</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {String(store.code)} · {String(store.name)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>開始日</span>
              <input type="date" name="from" defaultValue={from} />
            </label>
            <label className="field">
              <span>終了日</span>
              <input type="date" name="to" defaultValue={to} />
            </label>
            <label className="field">
              <span>状態</span>
              <select aria-label="状態" name="status" defaultValue={search.status ?? ""}>
                <option value="">すべての状態</option>
                {["imported", "confirmed", "monthly_finalized"].map((status) => (
                  <option key={status} value={status}>
                    {stateLabels[status]}
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row">
              <button type="submit" className="primary-button">
                集計を表示
              </button>
              <Link href={uiConfig.pages.sales.href} className="ghost-button">
                条件をクリア
              </Link>
            </div>
          </form>
        </section>
        <section className="metrics-grid admin-sales-metrics" aria-label="売上サマリー">
          {[
            { label: "売上合計", value: yen(totals.net), Icon: TrendingUp, tone: "green-icon" },
            {
              label: "客数",
              value: `${number(totals.customers)}人`,
              Icon: ShoppingBasket,
              tone: "blue-icon",
            },
            {
              label: "平均客単価",
              value: average(totals.net, totals.customers),
              Icon: Wallet,
              tone: "violet-icon",
            },
            {
              label: "締め前",
              value: `${totals.pending}件`,
              Icon: Activity,
              tone: "amber-icon",
            },
          ].map(({ label, value, Icon, tone }) => (
            <article className="metric-card" key={label}>
              <div className="metric-topline">
                <span>{label}</span>
                <span className={`metric-icon ${tone}`}>
                  <Icon size={18} aria-hidden="true" />
                </span>
              </div>
              <div className="metric-value">
                <strong>{value}</strong>
              </div>
              <div className="admin-sales-card-rule" aria-hidden="true" />
            </article>
          ))}
        </section>
        {!rows.length && (
          <section className="page-panel">
            <p role="status">
              条件に一致する売上はありません。店舗・期間・状態を変更してください。
            </p>
          </section>
        )}
        {!!rows.length && (
          <>
            <section className="admin-sales-visual-grid" aria-label="売上分析グラフ">
              <article className="panel sales-panel admin-sales-chart-panel">
                <div className="panel-heading">
                  <div>
                    <h2 className="panel-title">営業日別の売上推移</h2>
                    <p className="panel-subtitle">
                      {rows.at(-1)?.date} — {rows[0]?.date}
                    </p>
                  </div>
                  <strong className="admin-sales-chart-total">{yen(totals.net)}</strong>
                </div>
                <svg
                  className="admin-sales-chart"
                  viewBox="0 0 700 290"
                  role="img"
                  aria-label="営業日別の純売上グラフ"
                >
                  <defs>
                    <linearGradient id="admin-sales-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity=".24" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[58, 120, 182, 244].map((y) => (
                    <line key={y} x1="48" x2="652" y1={y} y2={y} className="chart-gridline" />
                  ))}
                  <path d={chartArea} className="admin-sales-chart-area" />
                  <polyline points={chartPoints} className="chart-line" />
                  {chartRows.map((row, index) => (
                    <g key={row.id}>
                      <circle cx={chartX(index)} cy={chartY(row.net)} r="5" className="chart-point">
                        <title>
                          {row.id}: {yen(row.net)}
                        </title>
                      </circle>
                      <text x={chartX(index)} y="276" textAnchor="middle">
                        {row.id.slice(5)}
                      </text>
                    </g>
                  ))}
                </svg>
              </article>
              <article className="panel sales-panel admin-store-ranking">
                <div className="panel-heading">
                  <div>
                    <h2 className="panel-title">店舗別売上</h2>
                    <p className="panel-subtitle">{targetStores.length}店舗</p>
                  </div>
                </div>
                <ol>
                  {byStore
                    .slice()
                    .sort((a, b) => (a.net === b.net ? 0 : a.net > b.net ? -1 : 1))
                    .slice(0, 5)
                    .map((row, index) => (
                      <li key={row.id}>
                        <span className="admin-store-rank">{index + 1}</span>
                        <div>
                          <span>
                            <strong>{String(storeName(row.id)?.name ?? "店舗情報なし")}</strong>
                            <b>{yen(row.net)}</b>
                          </span>
                          <span className="admin-store-bar" aria-hidden="true">
                            <i
                              style={{
                                width: `${row.net > 0n ? Number((row.net * 10000n) / storeMax) / 100 : 0}%`,
                              }}
                            />
                          </span>
                        </div>
                      </li>
                    ))}
                </ol>
              </article>
            </section>
            <details className="page-panel admin-sales-detail-panel">
              <summary>店舗別比較</summary>
              <div className="workspace-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">店舗</th>
                      <th scope="col">売上（円）</th>
                      <th scope="col">客数</th>
                      <th scope="col">客単価</th>
                      <th scope="col">締め前</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byStore.map((row) => (
                      <tr key={row.id}>
                        <th scope="row">{String(storeName(row.id)?.name ?? "店舗情報なし")}</th>
                        <td>{yen(row.net)}</td>
                        <td>{number(row.customers)}人</td>
                        <td>{average(row.net, row.customers)}</td>
                        <td>{row.pending}件</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <details className="page-panel admin-sales-detail-panel">
              <summary>営業日別売上の詳細</summary>
              <p className="muted">
                {rows.length}件 · {page} / {pageCount}ページ（サマリーは全件を集計）
              </p>
              <div className="workspace-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">営業日</th>
                      <th scope="col">店舗</th>
                      <th scope="col">売上（円）</th>
                      <th scope="col">客数</th>
                      <th scope="col">状態</th>
                      <th scope="col">詳細</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice((page - 1) * 20, page * 20).map((row) => (
                      <tr key={row.id}>
                        <th scope="row">{row.date}</th>
                        <td>{String(storeName(row.storeId)?.name ?? "店舗情報なし")}</td>
                        <td>{yen(row.net)}</td>
                        <td>{number(row.customers)}人</td>
                        <td>
                          <StateBadge
                            state={row.status}
                            label={stateLabels[row.status] ?? row.status}
                          />
                        </td>
                        <td>
                          <details>
                            <summary>内訳を表示</summary>
                            <dl>
                              <dt>総売上</dt>
                              <dd>{yen(row.gross)}</dd>
                              <dt>取引数</dt>
                              <dd>{number(row.transactions)}件</dd>
                              <dt>客単価</dt>
                              <dd>{average(row.net, row.customers)}</dd>
                            </dl>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <nav className="button-row" aria-label="売上一覧のページ">
                {page > 1 && (
                  <Link className="ghost-button" href={pageHref(page - 1)}>
                    前のページ
                  </Link>
                )}
                {page < pageCount && (
                  <Link className="ghost-button" href={pageHref(page + 1)}>
                    次のページ
                  </Link>
                )}
              </nav>
            </details>
          </>
        )}
      </div>
    </PageLayout>
  );
}
