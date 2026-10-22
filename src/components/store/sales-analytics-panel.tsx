"use client";

import { useEffect, useMemo, useState } from "react";

type Summary = {
  rows: Array<{
    businessDate: string;
    sales: number;
    customers: number;
    status: string;
  }>;
  totalSales: number;
  latestSales: number;
  previousSales: number;
  weekSales: number;
  monthSales: number;
  changeFromPreviousDay: number;
  labels: string[];
  series: number[];
  latestDate: string | null;
  customerCount: number;
  unitPrice: number | null;
};

function formatYen(value: number) {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

export function SalesAnalyticsPanel({ storeId }: { storeId?: string }) {
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ from, to });
    if (storeId) params.set("storeId", storeId);
    fetch(`/api/sales/summary?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("売上データの取得に失敗しました。");
        const json = await response.json();
        setSummary(json.summary);
        setError(null);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "取得に失敗しました。"),
      )
      .finally(() => setLoading(false));
  }, [from, to, storeId]);

  const trendPercent = useMemo(
    () => (summary ? `${summary.changeFromPreviousDay.toFixed(1)}%` : "0.0%"),
    [summary],
  );

  if (loading)
    return (
      <section className="page-panel">
        <h2>売上分析</h2>
        <p className="muted">売上を集計しています…</p>
      </section>
    );
  if (error)
    return (
      <section className="page-panel">
        <h2>売上分析</h2>
        <p className="login-error">{error}</p>
      </section>
    );
  if (!summary)
    return (
      <section className="page-panel">
        <h2>売上分析</h2>
        <p className="muted">表示できる売上データがありません。</p>
      </section>
    );

  return (
    <section className="page-panel">
      <div className="button-row">
        <h2>売上分析</h2>
        <a
          className="ghost-button"
          href={`/api/sales/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${storeId ? `&storeId=${encodeURIComponent(storeId)}` : ""}`}
        >
          CSVを出力
        </a>
      </div>
      <div className="workspace-fields">
        <label className="field">
          <span>開始日</span>
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setLoading(true);
              setFrom(event.target.value);
            }}
          />
        </label>
        <label className="field">
          <span>終了日</span>
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setLoading(true);
              setTo(event.target.value);
            }}
          />
        </label>
      </div>
      <section className="metrics-grid" aria-label="売上サマリー">
        <article className="metric-card">
          <div className="metric-topline">
            <span>前営業日比</span>
          </div>
          <div className="metric-value">
            <strong>{trendPercent}</strong>
          </div>
          <p className="metric-foot">{summary.latestDate ?? "データなし"}</p>
        </article>
        <article className="metric-card">
          <div className="metric-topline">
            <span>直近営業日の売上</span>
          </div>
          <div className="metric-value">
            <strong>{formatYen(summary.latestSales)}</strong>
          </div>
          <p className="metric-foot">{summary.latestDate ?? "データなし"}</p>
        </article>
        <article className="metric-card">
          <div className="metric-topline">
            <span>7日間売上</span>
          </div>
          <div className="metric-value">
            <strong>{formatYen(summary.weekSales)}</strong>
          </div>
          <p className="metric-foot">直近7営業日</p>
        </article>
        <article className="metric-card">
          <div className="metric-topline">
            <span>30日間売上</span>
          </div>
          <div className="metric-value">
            <strong>{formatYen(summary.monthSales)}</strong>
          </div>
          <p className="metric-foot">直近30日</p>
        </article>
      </section>
      <div className="workspace-table">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">日付</th>
              <th scope="col">売上</th>
              <th scope="col">客数</th>
            </tr>
          </thead>
          <tbody>
            {summary.labels.map((label, index) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{formatYen(summary.series[index])}</td>
                <td>{summary.rows[index]?.customers ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
