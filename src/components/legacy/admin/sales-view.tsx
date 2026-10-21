import { PageLayout } from "@/components/ui/page-layout";
import {
  getSalesDaysForList,
  getStoresForList,
} from "@/server/queries/compatibility";

const trendData = {
  day: [42, 58, 51, 66, 62, 81, 74],
  week: [120, 138, 126, 154, 148, 172, 168],
};

export default async function SalesPage() {
  const [salesRows, storesRows] = await Promise.all([
    getSalesDaysForList(),
    getStoresForList(),
  ]);
  const storeMap = new Map(storesRows.map((store) => [store.id, store]));

  const totalSales = salesRows.reduce(
    (sum, row) => sum + Number(row.net_sales_yen ?? 0),
    0,
  );
  const chartValues = trendData.week;

  return (
    <PageLayout page="sales">
      <section className="page-grid double">
        <article className="page-panel">
          <div className="panel-head">
            <div>
              <h2>売上推移</h2>
              <small>前日比を比較して締め状況を確認</small>
            </div>
          </div>

          <div className="stat-row">
            <div>
              <span className="muted">対象売上</span>
              <strong>¥{(totalSales / 10000).toLocaleString()}万</strong>
            </div>
            <div>
              <span className="muted">目標達成</span>
              <strong>101.4%</strong>
            </div>
          </div>

          <div className="chart-bars" aria-label="売上の推移">
            {chartValues.map((value, index) => (
              <div key={`week-${index}`} className="bar-wrap">
                <span
                  className="bar"
                  style={{ height: `${Math.max(value, 18)}%` }}
                />
                <small>{index + 1}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="page-panel">
          <div className="panel-head">
            <div>
              <h2>店舗別集計</h2>
              <small>営業日と店舗差を確認</small>
            </div>
          </div>

          <div className="metric-stack">
            <div className="mini-metric positive">
              <span>売上高</span>
              <strong>¥{Number(totalSales).toLocaleString()}</strong>
            </div>
            <div className="mini-metric neutral">
              <span>客数</span>
              <strong>
                {salesRows
                  .reduce(
                    (sum, row) => sum + Number(row.customer_count ?? 0),
                    0,
                  )
                  .toLocaleString()}
                人
              </strong>
            </div>
            <div className="mini-metric warning">
              <span>未締め件数</span>
              <strong>
                {salesRows.filter((row) => row.status !== "confirmed").length}件
              </strong>
            </div>
          </div>
        </article>
      </section>

      <section className="page-panel">
        <div className="panel-head">
          <div>
            <h2>売上一覧</h2>
            <small>営業日・店舗・ステータスで集計</small>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>店舗</th>
              <th>営業日</th>
              <th>売上</th>
              <th>客数</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {salesRows.map((row) => {
              const store = storeMap.get(row.store_id);
              return (
                <tr key={row.id}>
                  <td>{store?.name ?? "不明店舗"}</td>
                  <td>
                    {new Date(row.business_date).toLocaleDateString("ja-JP")}
                  </td>
                  <td>¥{Number(row.net_sales_yen ?? 0).toLocaleString()}</td>
                  <td>{Number(row.customer_count ?? 0).toLocaleString()}人</td>
                  <td>
                    <span
                      className={`status ${row.status === "confirmed" ? "ok" : "warning"}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </PageLayout>
  );
}
