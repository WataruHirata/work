"use client";

import { Activity, ShoppingBasket, TrendingUp, Wallet } from "@/components/ui/icons";
import { StateBadge } from "@/components/ui/state-badge";
import { CollapsibleTable } from "@/components/ui/collapsible-table";

// Fictional preview only: store identification and production data access are pending.
const days = [
  { date: "10/15", sales: 780000, customers: 650 },
  { date: "10/16", sales: 864000, customers: 720 },
  { date: "10/17", sales: 1056000, customers: 880 },
  { date: "10/18", sales: 1152000, customers: 960 },
  { date: "10/19", sales: 816000, customers: 680 },
  { date: "10/20", sales: 900000, customers: 750 },
  { date: "10/21", sales: 960000, customers: 800 },
];
const departments = [
  { name: "青果", sales: 288000 },
  { name: "食品", sales: 240000 },
  { name: "惣菜", sales: 192000 },
  { name: "精肉", sales: 144000 },
  { name: "鮮魚", sales: 96000 },
];
const yen = (value: number) => `¥${value.toLocaleString("ja-JP")}`;
const today = days[days.length - 1];
const yesterday = days[days.length - 2];
const change = ((today.sales / yesterday.sales - 1) * 100).toFixed(1);
const points = days
  .map((day, i) => `${50 + i * 100},${286 - (day.sales / 1200000) * 234}`)
  .join(" ");

export function StoreOverview() {
  return (
    <div className="content">
      <div className="demo-banner" role="status">
        <span className="demo-badge">SAMPLE</span>
        <span>架空のサンプルデータです。実店舗・POSデータには接続していません。</span>
      </div>
      <section className="page-heading">
        <div>
          <p className="eyebrow">STORE OVERVIEW</p>
          <h2>店舗のいまを、ひと目で。</h2>
          <p>デモ店舗 · 営業日 2026年10月21日 · 日次売上（税込）の表示例</p>
        </div>
        <StateBadge state="not_configured" label="サンプル / 未確定" />
      </section>
      <section className="metrics-grid" aria-label="デモ店舗の営業指標">
        {[
          {
            label: "当日の売上",
            value: yen(today.sales),
            note: `前日比 +${change}%`,
            Icon: TrendingUp,
          },
          {
            label: "当日の客数",
            value: `${today.customers.toLocaleString("ja-JP")}人`,
            note: `前日 ${yesterday.customers}人`,
            Icon: ShoppingBasket,
          },
          {
            label: "客単価",
            value: yen(today.sales / today.customers),
            note: "売上 ÷ 客数",
            Icon: Wallet,
          },
          {
            label: "直近7日間の売上",
            value: yen(days.reduce((sum, day) => sum + day.sales, 0)),
            note: "2026/10/15 − 10/21",
            Icon: Activity,
          },
        ].map(({ label, value, note, Icon }) => (
          <article className="metric-card" key={label}>
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
          </article>
        ))}
      </section>
      <section className="dashboard-grid" aria-label="店舗売上の可視化">
        <article className="panel sales-panel store-sales-trend-panel">
          <div className="panel-heading">
            <div>
              <h2 className="panel-title">売上の推移</h2>
              <p className="panel-subtitle">デモ店舗 · 2026/10/15 − 10/21 · 税込 / 円</p>
            </div>
            <StateBadge state="draft" label="日次売上" />
          </div>
          <svg
            className="store-trend"
            viewBox="0 0 700 350"
            role="img"
            aria-labelledby="store-trend-title store-trend-desc"
          >
            <title id="store-trend-title">直近7日間の売上推移（サンプル）</title>
            <desc id="store-trend-desc">
              10月18日の115万2千円が最大。当日は96万円。各日の正確な値は下の売上データ表で確認できます。
            </desc>
            {[0, 400000, 800000, 1200000].map((value) => (
              <g key={value}>
                <line
                  x1="50"
                  x2="650"
                  y1={286 - (value / 1200000) * 234}
                  y2={286 - (value / 1200000) * 234}
                  className="chart-gridline"
                />
                <text x="0" y={290 - (value / 1200000) * 234}>
                  {value / 10000}万
                </text>
              </g>
            ))}
            <polyline points={points} pathLength="1" className="chart-line" />
            {days.map((day, i) => (
              <g key={day.date}>
                <circle
                  cx={50 + i * 100}
                  cy={286 - (day.sales / 1200000) * 234}
                  r="4"
                  className="chart-point"
                >
                  <title>
                    {day.date}: {yen(day.sales)}
                  </title>
                </circle>
                <text x={50 + i * 100} y="325" textAnchor="middle">
                  {day.date}
                </text>
              </g>
            ))}
          </svg>
          <details className="store-data" open>
            <summary>売上データを表で確認</summary>
            <CollapsibleTable
              className=""
              containerClassName="table-scroll"
              defaultExpanded
              caption="デモ店舗の日次データ（税込・サンプル）"
              head={
                <tr>
                  <th scope="col">営業日（2026年）</th>
                  <th scope="col">売上（円）</th>
                  <th scope="col">客数（人）</th>
                </tr>
              }
            >
              {days.map((day) => (
                <tr key={day.date}>
                  <th scope="row">{day.date}</th>
                  <td>{yen(day.sales)}</td>
                  <td>{day.customers}</td>
                </tr>
              ))}
            </CollapsibleTable>
          </details>
        </article>
        <article className="panel sales-panel">
          <h2 className="panel-title">部門別の売上構成</h2>
          <p className="panel-subtitle">デモ店舗 · 2026/10/21 · 税込 / 円</p>
          <ul className="department-list">
            {departments.map((department) => (
              <li key={department.name}>
                <div>
                  <strong>{department.name}</strong>
                  <span>
                    {yen(department.sales)} · {(department.sales / today.sales) * 100}%
                  </span>
                </div>
                <div className="department-track" aria-hidden="true">
                  <span
                    style={{
                      width: `${(department.sales / today.sales) * 100}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="muted">部門合計 {yen(today.sales)} / 構成比 100%</p>
        </article>
      </section>
    </div>
  );
}
