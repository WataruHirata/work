/** Compatibility DTOs. New screens depend on BusinessRepository directly. */
import { repository } from "@/server/container";
import { allRecords } from "@/server/queries/workspaces";
export async function getStoresForList() {
  return (await allRecords("stores")).map((row) => ({
    id: row.id,
    code: String(row.code),
    name: String(row.name),
    status: String(row.status),
    area_id: String(row.area_id),
    created_at: String(row.updated_at),
  }));
}
export async function getSalesDaysForList() {
  return (await repository().list("sales")).rows.map((row) => ({
    id: row.id,
    store_id: String(row.store_id),
    business_date: String(row.business_date),
    status: String(row.status),
    gross_sales_yen: Number(row.gross_sales_yen),
    net_sales_yen: Number(row.net_sales_yen),
    customer_count: Number(row.customer_count),
    transaction_count: Number(row.transaction_count),
  }));
}
export async function getSalesCorrectionsForList() {
  return (await repository().list("corrections")).rows.map((row) => ({
    id: row.id,
    sales_day_id: String(row.sales_day_id),
    reason: String(row.reason),
    before_amount_yen: Number(row.before_amount_yen),
    after_amount_yen: Number(row.after_amount_yen),
    status: String(row.status),
    requested_at: String(row.requested_at),
  }));
}
