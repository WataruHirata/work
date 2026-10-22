"use client";

import { Activity, ShoppingBasket, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { storeSummary } from "@/domain/store-summary";
import type { Json } from "@/domain/contracts";
import { CollapsibleTable } from "@/components/ui/collapsible-table";
import { CollapsibleList } from "@/components/ui/collapsible-list";
import { uiConfig } from "@/config/ui";
export function LiveStoreOverview({ snapshot }: { snapshot: Record<string, Json> }) {
  const summary = storeSummary(snapshot);
  const notices = (Array.isArray(snapshot.notices) ? snapshot.notices : []).flatMap((notice) => {
    if (!notice || typeof notice !== "object" || Array.isArray(notice)) return [];
    const { id, title, message, created_at: createdAt } = notice;
    if (typeof title !== "string" || typeof message !== "string") return [];
    return [
      {
        id: typeof id === "string" ? id : `${String(createdAt ?? "")}:${title}`,
        title,
        message,
        createdAt: typeof createdAt === "string" ? createdAt : "",
      },
    ];
  });
  const yen = (value: number) => `¥${Math.round(value).toLocaleString("ja-JP")}`;
  const max = Math.max(1, ...summary.days.map((day) => day.sales));
  const x = (index: number) =>
    50 + (summary.days.length > 1 ? (index * 600) / (summary.days.length - 1) : 300);
  const y = (value: number) => 220 - (value / max) * 180;
  const points = summary.days.map((day, index) => `${x(index)},${y(day.sales)}`).join(" ");
  return (
    <div className="content">
      <div className="store-overview-grid">
        <div className="store-overview-sidebar">
          <section className="metrics-grid" aria-label="接続店舗の営業指標">
            {[
              {
                label: "本日の売上",
                value: summary.latest ? yen(summary.latest.sales) : "—",
                note: summary.latest
                  ? `${summary.latest.date} · ${summary.change === null ? "比較対象なし" : `前営業日比 ${summary.change.toFixed(1)}%`}`
                  : "売上データなし",
                Icon: TrendingUp,
                href: uiConfig.pages.storeSales.href,
              },
              {
                label: "在庫アラート件数",
                value:
                  summary.inventoryAlertCount === null ? "—" : `${summary.inventoryAlertCount}件`,
                note: "在庫数量0以下",
                Icon: Activity,
                href: uiConfig.pages.storeSales.href,
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
                  summary.campaignPendingCount === null ? "—" : `${summary.campaignPendingCount}件`,
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
          </section>
          <section className="panel store-notices-panel" aria-labelledby="store-notices-title">
            <div className="panel-head">
              <h2 className="panel-title" id="store-notices-title">
                お知らせ
              </h2>
            </div>
            {notices.length ? (
              <CollapsibleList className="notice-list">
                {notices.map((notice) => {
                  const date = new Date(notice.createdAt);
                  const dateLabel = Number.isNaN(date.valueOf())
                    ? notice.createdAt
                    : date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
                  return (
                    <article className="store-announcement-card" key={notice.id}>
                      <h3>{notice.title}</h3>
                      {dateLabel && <p className="store-announcement-date">{dateLabel}</p>}
                      <p className="store-announcement-message">{notice.message}</p>
                    </article>
                  );
                })}
              </CollapsibleList>
            ) : (
              <p className="empty-state">この店舗宛てのお知らせはありません。</p>
            )}
          </section>
        </div>
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
              <CollapsibleTable
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
