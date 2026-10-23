"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  CloudDownload,
  Package,
  ShoppingBasket,
  Sun,
  Store,
  TrendingUp,
} from "lucide-react";
import { CollapsibleTable } from "@/components/ui/collapsible-table";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const weeklySeries = {
  week: [36, 48, 41, 65, 54, 73, 61],
  month: [42, 39, 58, 50, 70, 62, 79],
};

const imports = [
  {
    store: "デモ店舗・標準",
    code: "DEMO-001",
    time: "06:14",
    state: "取込完了",
  },
  {
    store: "デモ店舗・24時間",
    code: "DEMO-002",
    time: "06:12",
    state: "取込完了",
  },
  {
    store: "デモ店舗・モール",
    code: "DEMO-003",
    time: "06:09",
    state: "要確認",
  },
];

function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

export function SalesDashboard() {
  const router = useRouter();
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [selectedArea, setSelectedArea] = useState("全エリア");
  const chartData = useMemo(() => weeklySeries[period], [period]);
  const max = Math.max(...chartData);
  const points = chartData
    .map((value, index) => `${40 + index * 116},${210 - (value / max) * 164}`)
    .join(" ");
  const area = `M ${points.replaceAll(" ", " L ")} L 736,218 L 40,218 Z`;

  const goTo = (path: string) => router.push(path);

  return (
    <main className="dashboard-page" id="main-content" tabIndex={-1}>
      <div className="content" id="overview">
        <div className="demo-banner" role="status">
          <span className="demo-badge">DEMO</span>
          <span>
            画面プレビューです。表示データは架空で、実際の売上・POS連携には接続していません。
          </span>
          <ArrowRight size={15} aria-hidden="true" />
        </div>

        <section className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" /> 2026年10月21日（水）{" "}
              <span className="heading-time">· 09:00 更新</span>
            </div>
            <h1>
              おはようございます <Sun className="heading-icon" size={22} aria-hidden="true" />
              <br className="mobile-break" />
              本部スタッフさん
            </h1>
            <p>今日も店舗の状況を確認していきましょう。</p>
          </div>
          <div className="heading-controls">
            <label className="select-wrap">
              <span className="sr-only">表示エリア</span>
              <Store size={16} aria-hidden="true" />
              <select
                value={selectedArea}
                onChange={(event) => setSelectedArea(event.target.value)}
              >
                <option>全エリア</option>
                <option>デモエリア A</option>
                <option>デモエリア B</option>
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </label>
            <button
              className="date-button"
              type="button"
              onClick={() => setPeriod((current) => (current === "week" ? "month" : "week"))}
            >
              <CalendarDays size={16} />
              <span>{period === "week" ? "1週間" : "1か月"}</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </section>

        <section className="metrics-grid" aria-label="売上の概要">
          <article className="metric-card featured-card">
            <div className="metric-topline">
              <span>本日の売上速報</span>
              <span className="metric-icon green-icon">
                <TrendingUp size={17} />
              </span>
            </div>
            <div className="metric-value">
              ¥<strong>8,426,580</strong>
            </div>
            <div className="metric-foot">
              <span className="trend positive">
                <ArrowUpRight size={14} /> 8.2%
              </span>
              <span>前週同曜日比</span>
              <span className="metric-foot-end">112店舗</span>
            </div>
            <div className="sparkline" aria-hidden="true">
              <svg viewBox="0 0 240 42" preserveAspectRatio="none">
                <path d="M0 35 C20 33 24 22 44 27 S72 34 89 18 S117 28 136 16 S157 22 176 12 S205 18 240 2" />
              </svg>
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-topline">
              <span>来店客数</span>
              <span className="metric-icon blue-icon">
                <ShoppingBasket size={17} />
              </span>
            </div>
            <div className="metric-value">
              <strong>4,218</strong>
              <span className="metric-unit">人</span>
            </div>
            <div className="metric-foot">
              <span className="trend positive">
                <ArrowUpRight size={14} /> 3.6%
              </span>
              <span>前週同曜日比</span>
            </div>
            <div className="mini-bars" aria-hidden="true">
              {[34, 45, 39, 54, 42, 63, 51, 72, 58, 82, 65, 91].map((height, index) => (
                <i
                  key={index}
                  style={{
                    height: `${height}%`,
                    animationDelay: `calc(var(--motion-stagger) * ${index})`,
                  }}
                />
              ))}
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-topline">
              <span>平均客単価</span>
              <span className="metric-icon violet-icon">
                <Activity size={17} />
              </span>
            </div>
            <div className="metric-value">
              ¥<strong>1,998</strong>
            </div>
            <div className="metric-foot">
              <span className="trend negative">
                <ArrowDownRight size={14} /> 1.2%
              </span>
              <span>前週同曜日比</span>
            </div>
            <div className="metric-note">
              <span className="note-dash" /> 全店平均 ¥1,964
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-topline">
              <span>POSデータ連携</span>
              <span className="metric-icon amber-icon">
                <CloudDownload size={17} />
              </span>
            </div>
            <div className="metric-value">
              <strong>109</strong>
              <span className="metric-divider">/</span>
              <span className="metric-total">112</span>
              <span className="metric-unit">店舗</span>
            </div>
            <div className="metric-foot">
              <span className="import-state">
                <span /> 3店舗の確認が必要
              </span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="POSデータ連携完了率"
              aria-valuemin={0}
              aria-valuemax={112}
              aria-valuenow={109}
            >
              <span />
            </div>
          </article>
        </section>

        <section className="dashboard-grid" id="sales">
          <article className="panel sales-panel">
            <div className="panel-heading">
              <div>
                <div className="panel-title">売上の推移</div>
                <div className="panel-subtitle">全店舗 · 税込売上速報</div>
              </div>
              <div className="segmented-control" role="group" aria-label="売上表示期間">
                <button
                  className={period === "week" ? "selected" : ""}
                  type="button"
                  onClick={() => setPeriod("week")}
                  aria-pressed={period === "week"}
                >
                  1週間
                </button>
                <button
                  className={period === "month" ? "selected" : ""}
                  type="button"
                  onClick={() => setPeriod("month")}
                  aria-pressed={period === "month"}
                >
                  1か月
                </button>
              </div>
            </div>
            <div className="chart-summary">
              <strong>¥ 8,426,580</strong>
              <span className="trend positive">
                <ArrowUpRight size={14} /> 8.2%
              </span>
              <small>前週同曜日比</small>
            </div>
            <div className="chart-wrap">
              <div className="chart-y-labels" aria-hidden="true">
                <span>1,000万</span>
                <span>750万</span>
                <span>500万</span>
                <span>250万</span>
                <span>0</span>
              </div>
              <svg
                className="sales-chart"
                viewBox="0 0 800 248"
                role="img"
                aria-labelledby="sales-chart-title sales-chart-desc"
                preserveAspectRatio="none"
              >
                <title id="sales-chart-title">過去7日間の売上推移</title>
                <desc id="sales-chart-desc">
                  架空のデモ値です。直近7日間の各日売上をグラフで表示しています。
                </desc>
                <defs>
                  <linearGradient id="sales-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-2b8f70)" stopOpacity=".19" />
                    <stop offset="100%" stopColor="var(--color-2b8f70)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[38, 82, 126, 170, 214].map((y) => (
                  <line key={y} x1="40" x2="736" y1={y} y2={y} className="chart-gridline" />
                ))}
                <path d={area} className="chart-area" />
                <polyline points={points} pathLength="1" className="chart-line" />
                {chartData.map((value, index) => (
                  <circle
                    key={`${period}-${index}`}
                    cx={40 + index * 116}
                    cy={210 - (value / max) * 164}
                    r={index === chartData.length - 1 ? 5 : 3.2}
                    className={
                      index === chartData.length - 1 ? "chart-point current" : "chart-point"
                    }
                  >
                    <title>{`${["水", "木", "金", "土", "日", "月", "火"][index]}曜日・デモ売上 ¥${formatYen(value * 100000)}`}</title>
                  </circle>
                ))}
              </svg>
            </div>
            <div className="chart-x-labels" aria-hidden="true">
              {["10/15", "10/16", "10/17", "10/18", "10/19", "10/20", "10/21"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="chart-legend">
              <span className="legend-dot" /> 売上速報{" "}
              <span className="legend-note">※ 前日分はPOS連携後に更新</span>
            </div>
          </article>

          <article className="panel actions-panel" id="approvals">
            <div className="panel-heading">
              <div>
                <div className="panel-title">今日の確認事項</div>
                <div className="panel-subtitle">対応が必要なタスク</div>
              </div>
              <span className="task-total">3</span>
            </div>
            <button
              type="button"
              className="action-item alert-action"
              onClick={() => goTo("/imports")}
            >
              <span className="action-icon alert-icon">
                <CloudDownload size={17} />
              </span>
              <span className="action-copy">
                <strong>POSデータ未連携</strong>
                <small>3店舗 · 最終確認 06:30</small>
              </span>
              <ArrowRight size={16} />
            </button>
            <button type="button" className="action-item" onClick={() => goTo("/approvals")}>
              <span className="action-icon approval-icon">
                <ClipboardCheck size={17} />
              </span>
              <span className="action-copy">
                <strong>売上修正の承認待ち</strong>
                <small>2件 · エリアマネージャー</small>
              </span>
              <span className="action-count">2</span>
            </button>
            <button type="button" className="action-item" onClick={() => goTo("/campaigns")}>
              <span className="action-icon campaign-icon">
                <Package size={17} />
              </span>
              <span className="action-copy">
                <strong>特売の終了予定</strong>
                <small>本日 18:00 · 8商品</small>
              </span>
              <ArrowRight size={16} />
            </button>
            <button type="button" className="all-tasks-link" onClick={() => goTo("/approvals")}>
              すべての確認事項を見る <ArrowRight size={15} />
            </button>
            <div className="completion-card">
              <div className="completion-top">
                <span>本日の業務進捗</span>
                <strong>
                  78<span>%</span>
                </strong>
              </div>
              <div
                className="completion-track"
                role="progressbar"
                aria-label="本日の業務進捗"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={78}
              >
                <span />
              </div>
              <div className="completion-foot">
                <span>
                  <Check size={13} /> 完了 7件
                </span>
                <span>残り 2件</span>
              </div>
            </div>
          </article>
        </section>

        <section className="panel imports-panel" id="imports">
          <div className="panel-heading">
            <div>
              <div className="panel-title">POSデータ連携状況</div>
              <div className="panel-subtitle">2026年10月20日分 · 前日売上</div>
            </div>
            <button type="button" className="table-link" onClick={() => goTo("/imports")}>
              全店舗の状況を見る <ArrowRight size={15} />
            </button>
          </div>
          <CollapsibleTable
            className=""
            containerClassName="table-scroll"
            head={
              <tr>
                <th>店舗</th>
                <th>店舗コード</th>
                <th>最終連携</th>
                <th>ステータス</th>
                <th>
                  <span className="sr-only">詳細</span>
                </th>
              </tr>
            }
          >
            {imports.map((item, index) => (
              <tr key={item.code} className={`table-row row-${index}`}>
                <td>
                  <span className="store-avatar">
                    <Store size={15} />
                  </span>
                  <strong>{item.store}</strong>
                </td>
                <td className="code-cell">{item.code}</td>
                <td className="time-cell">{item.time}</td>
                <td>
                  <span className={`status-badge ${index === 2 ? "needs-attention" : "complete"}`}>
                    <i />
                    {item.state}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="row-action"
                    aria-label={`${item.store}の詳細を見る`}
                    onClick={() => goTo("/imports")}
                  >
                    <ArrowRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </CollapsibleTable>
          <div className="table-footer">
            <CircleAlert size={14} />
            <span>この一覧はデモ用の架空データです。実連携は接続設定後に有効になります。</span>
          </div>
        </section>

        <footer className="footer">
          <span>
            みのり屋 販売管理システム <span className="footer-separator">·</span> 開発プレビュー
          </span>
          <span>
            データ表示: デモ <span className="footer-separator">·</span>{" "}
            <button type="button" onClick={() => goTo("/settings")}>
              ヘルプ・操作ガイド
            </button>
          </span>
        </footer>
      </div>
    </main>
  );
}
