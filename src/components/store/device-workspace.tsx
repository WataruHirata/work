import Link from "next/link";
import { PageLayout } from "@/components/ui/page-layout";
import { columnLabels, stateLabels, type PageId } from "@/config/ui";
import type { Json } from "@/domain/contracts";

export function DeviceWorkspace({ feature, snapshot }: { feature: PageId; snapshot: Record<string, Json> }) {
  const store = snapshot.store as { name?: string };
  const groups = feature === "storeSales" ? ["sales", "inventory"] : feature === "storeCampaigns" ? ["campaigns"] : feature === "storeNotices" ? ["notices"] : feature === "storeOrders" ? ["orders"] : ["sales"];
  const titles: Record<string, string> = { sales: "営業日別売上", inventory: "基幹在庫", campaigns: "自店舗の特売", notices: "店舗のお知らせ", orders: "発注履歴" };
  return <PageLayout page={feature}><section className="page-panel"><p>{store?.name ?? "接続店舗"} · 閲覧用の店舗端末</p><Link className="ghost-button" href={`/login?next=${encodeURIComponent(feature === "storeSales" ? "/store/operations" : "/store/" + (feature === "storeOrders" ? "orders" : feature === "storeCampaigns" ? "campaigns" : feature === "storeNotices" ? "notices" : "operations"))}`}>個人ログインして操作する</Link></section>{groups.map((group) => {
    const rows = (snapshot[group] ?? []) as Record<string, Json>[];
    const columns = rows[0] ? Object.keys(rows[0]) : [];
    return <section key={group} className="page-panel"><h2>{titles[group]}</h2>{rows.length ? <div className="workspace-table"><table className="data-table"><thead><tr>{columns.map((key) => <th key={key} scope="col">{columnLabels[key] ?? key}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((key) => <td key={key}>{key === "status" ? stateLabels[String(row[key])] ?? String(row[key]) : typeof row[key] === "object" && row[key] !== null ? JSON.stringify(row[key]) : String(row[key] ?? "—")}</td>)}</tr>)}</tbody></table></div> : <p>対象データはありません。</p>}</section>;
  })}</PageLayout>;
}
