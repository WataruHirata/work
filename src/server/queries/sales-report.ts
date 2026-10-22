import "server-only";
import { allRecords } from "@/server/queries/workspaces";
import { requireAdminFeature } from "@/server/auth/admin-access";
import { date, uuid } from "@/server/validation";
import { salesEntry, totalSales, salesBy } from "@/domain/sales-report";
import { uiConfig } from "@/config/ui";

export type SalesSearch = {
  store?: string;
  area?: string;
  from?: string;
  to?: string;
  status?: string;
  page?: string;
};

export async function loadSalesReport(search: SalesSearch) {
  await requireAdminFeature("sales");
  const from = search.from ? date(search.from) : undefined;
  const to = search.to ? date(search.to) : undefined;
  if (from && to && from > to) throw new Error("終了日は開始日以降にしてください。");
  const storeId = search.store ? uuid(search.store) : undefined;
  const areaId = search.area ? uuid(search.area) : undefined;
  if (search.status && !["imported", "confirmed", "monthly_finalized"].includes(search.status))
    throw new Error("売上の状態を選び直してください。");
  const [stores, areas] = await Promise.all([allRecords("stores"), allRecords("areas")]);
  if (storeId && !stores.some((row) => row.id === storeId))
    throw new Error("対象店舗を参照できません。");
  if (areaId && !stores.some((row) => row.area_id === areaId))
    throw new Error("対象エリアを参照できません。");
  const targetStores = stores.filter(
    (row) => (!storeId || row.id === storeId) && (!areaId || row.area_id === areaId),
  );
  const targetIds = new Set(targetStores.map((row) => row.id));
  const rows = (await allRecords("sales", { storeId, from, to }))
    .map(salesEntry)
    .filter((row) => targetIds.has(row.storeId) && (!search.status || row.status === search.status))
    .sort((a, b) => b.date.localeCompare(a.date) || a.storeId.localeCompare(b.storeId));
  const totals = totalSales(rows);
  const byStore = salesBy(rows, "storeId");
  const byDate = salesBy(rows, "date");
  const max = byDate.reduce((value, row) => (row.net > value ? row.net : value), 0n);
  const pageCount = Math.max(1, Math.ceil(rows.length / 20));
  const page = Math.min(pageCount, Math.max(1, Number.parseInt(search.page ?? "1", 10) || 1));
  const pageHref = (next: number) => {
    const params = new URLSearchParams();
    for (const key of ["store", "area", "from", "to", "status"] as const)
      if (search[key]) params.set(key, search[key]);
    params.set("page", String(next));
    return `${uiConfig.pages.sales.href}?${params}`;
  };
  const storeName = (id: string) => stores.find((row) => row.id === id);

  return {
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
  };
}
