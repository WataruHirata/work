"use client";

import { Activity, ShoppingBasket, TrendingUp, Wallet } from "lucide-react";
import { storeSummary } from "@/domain/store-summary";
import type { Json } from "@/domain/contracts";
import { StateBadge } from "@/components/ui/state-badge";
export function LiveStoreOverview({ snapshot }: { snapshot: Record<string, Json> }) {
  const summary = storeSummary(snapshot);
  const yen = (value: number) => `¥${Math.round(value).toLocaleString("ja-JP")}`;
  const max = Math.max(1, ...summary.days.map((day) => day.sales));
  const x = (index: number) =>
    50 + (summary.days.length > 1 ? (index * 600) / (summary.days.length - 1) : 300);
  const y = (value: number) => 220 - (value / max) * 180;
  const points = summary.days.map((day, index) => `${x(index)},${y(day.sales)}`).join(" ");
  return (
    <div className="content store-overview">
      <section className="page-heading">
        <div>
          <p className="eyebrow">STORE OVERVIEW</p>
          <h2>{summary.storeName}</h2>
          <p>直近営業日 {summary.latest?.date ?? "データなし"} · 税込売上</p>
        </div>
        {summary.latest ? (
          <StateBadge state={summary.latest.status} />
        ) : (
          <StateBadge state="not_configured" label="未取込" />
        )}
      </section>
      <section className="metrics-grid" aria-label="接続店舗の営業指標">
        {[
          {
            label: "直近営業日の売上",
            value: summary.latest ? yen(summary.latest.sales) : "—",
            note:
              summary.change === null ? "比較対象なし" : `前営業日比 ${summary.change.toFixed(1)}%`,
            Icon: TrendingUp,
          },
          {
            label: "客数",
            value: summary.latest ? `${summary.latest.customers.toLocaleString("ja-JP")}人` : "—",
            note: "同営業日",
            Icon: ShoppingBasket,
          },
          {
            label: "客単価",
            value: summary.unitPrice === null ? "—" : yen(summary.unitPrice),
            note: "売上 ÷ 客数",
            Icon: Wallet,
          },
          {
            label: "表示期間の売上",
            value: yen(summary.total),
            note: `${summary.days.length}営業日`,
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
      <section className="panel sales-panel">
        <h2 className="panel-title">店舗売上の推移</h2>
        {summary.days.length ? (
          <>
            <svg
              className="store-trend"
              viewBox="0 0 700 270"
              role="img"
              aria-labelledby="live-trend-title"
            >
              <title id="live-trend-title">
                {summary.storeName}
                の直近営業日別売上。正確な数値は下の表で確認できます。
              </title>
              <polyline points={points} className="chart-line" />
              {summary.days.map((day, index) => (
                <g key={day.date}>
                  <circle cx={x(index)} cy={y(day.sales)} r="4" className="chart-point">
                    <title>
                      {day.date}: {yen(day.sales)}
                    </title>
                  </circle>
                  <text x={x(index)} y="250" textAnchor="middle">
                    {day.date.slice(5)}
                  </text>
                </g>
              ))}
            </svg>
            <div className="workspace-table">
              <table className="data-table">
                <caption>DBに保存された営業日別データ（税込・円）</caption>
                <thead>
                  <tr>
                    <th scope="col">営業日</th>
                    <th scope="col">売上</th>
                    <th scope="col">客数</th>
                    <th scope="col">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.days.map((day) => (
                    <tr key={day.date}>
                      <th scope="row">{day.date}</th>
                      <td>{yen(day.sales)}</td>
                      <td>{day.customers}</td>
                      <td>
                        <StateBadge state={day.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p>まだ売上データが取り込まれていません。</p>
        )}
      </section>
    </div>
  );
}
