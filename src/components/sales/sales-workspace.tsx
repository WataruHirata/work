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
    max,
    pageCount,
    page,
    pageHref,
    storeName,
  } = report;
  return (
    <PageLayout page="sales">
      <section className="page-panel">
        <h2>売上を絞り込む</h2>
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
        <p className="muted">
          表示範囲：{rows.at(-1)?.date ?? "—"} ～ {rows[0]?.date ?? "—"} · {targetStores.length}
          店舗 · {rows.length}件。金額は取込済みの純売上です。締め前の速報値を含みます。
        </p>
      </section>
      <section className="page-panel" aria-labelledby="sales-summary-heading">
        <h2 id="sales-summary-heading">売上サマリー</h2>
        <div className="sales-summary-grid">
          {[
            ["売上合計", yen(totals.net)],
            ["客数", `${number(totals.customers)}人`],
            ["客単価（円単位に四捨五入）", average(totals.net, totals.customers)],
            ["締め前", `${totals.pending}件`],
          ].map(([label, value]) => (
            <div className="sales-summary-item" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>
      {!rows.length && (
        <section className="page-panel">
          <p role="status">条件に一致する売上はありません。店舗・期間・状態を変更してください。</p>
        </section>
      )}
      {!!rows.length && (
        <>
          <section className="page-panel">
            <h2>営業日別の売上推移</h2>
            <p className="muted">
              各営業日の合計です。棒の長さは正の売上を比較し、マイナス額を含む金額は表で確認できます。
            </p>
            <div className="sales-trend" aria-label="営業日別の純売上">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">営業日</th>
                    <th scope="col">売上（円）</th>
                    <th scope="col">客数</th>
                  </tr>
                </thead>
                <tbody>
                  {byDate.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">{row.id}</th>
                      <td>
                        <span className="sales-trend-value">{yen(row.net)}</span>
                        <span className="sales-trend-track" aria-hidden="true">
                          <span
                            style={{
                              width: `${max > 0n && row.net > 0n ? Number((row.net * 10000n) / max) / 100 : 0}%`,
                            }}
                          />
                        </span>
                      </td>
                      <td>{number(row.customers)}人</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="page-panel">
            <h2>店舗別比較</h2>
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
          </section>
          <section className="page-panel">
            <h2>営業日別売上の詳細</h2>
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
          </section>
        </>
      )}
    </PageLayout>
  );
}
