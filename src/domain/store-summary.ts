import type { Json } from "@/domain/contracts";
export function storeSummary(snapshot: Record<string, Json>) {
  if (!snapshot.store || typeof snapshot.store !== "object" || Array.isArray(snapshot.store))
    throw new Error("店舗情報が不正です。");
  const raw = Array.isArray(snapshot.sales) ? snapshot.sales : [];
  const days = raw
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item))
        throw new Error("売上データが不正です。");
      const sales = Number(item.net_sales_yen),
        customers = Number(item.customer_count);
      if (
        !Number.isSafeInteger(sales) ||
        !Number.isSafeInteger(customers) ||
        customers < 0 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(String(item.business_date))
      )
        throw new Error("売上の表示値が不正です。");
      return {
        date: String(item.business_date),
        sales,
        customers,
        status: String(item.status),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);
  const latest = days.at(-1),
    prior = days.at(-2);
  const total = days.reduce((sum, day) => sum + day.sales, 0);
  if (!Number.isSafeInteger(total)) throw new Error("合計売上が表示範囲を超えています。");
  const metrics =
    snapshot.metrics && typeof snapshot.metrics === "object" && !Array.isArray(snapshot.metrics)
      ? snapshot.metrics
      : {};
  const metricCount = (key: string) => {
    const value = metrics[key];
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
  };
  return {
    storeName: String(snapshot.store.name),
    days,
    latest,
    total,
    unitPrice: latest?.customers ? latest.sales / latest.customers : null,
    change: latest && prior?.sales ? (latest.sales / prior.sales - 1) * 100 : null,
    inventoryAlertCount: metricCount("inventory_alert_count"),
    noticeCount: metricCount("notice_count"),
    campaignPendingCount: metricCount("campaign_pending_count"),
  };
}
