import "server-only";
import { repository } from "@/server/container";
import type { QueryOptions } from "@/domain/contracts";

export type SalesSummary = {
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

export async function getSalesSummary(options: QueryOptions = {}): Promise<SalesSummary> {
  const page = await repository().list("sales", { ...options, page: 1 });
  const rows = (page.rows ?? [])
    .map((row) => {
      const businessDate = String(row.business_date ?? "");
      const sales = Number(row.net_sales_yen ?? 0);
      const customers = Number(row.customer_count ?? 0);
      if (!businessDate || !Number.isFinite(sales) || !Number.isFinite(customers)) return null;
      return {
        businessDate,
        sales,
        customers,
        status: String(row.status ?? "imported"),
      };
    })
    .filter((row): row is Exclude<typeof row, null> => row !== null);

  const sorted = [...rows].sort((a, b) => a.businessDate.localeCompare(b.businessDate));
  const labels = sorted.map((row) => row.businessDate);
  const series = sorted.map((row) => row.sales);
  const totalSales = series.reduce((sum, value) => sum + value, 0);
  const latestDate = labels.at(-1) ?? null;
  const latestSales = sorted.at(-1)?.sales ?? 0;
  const previousSales = sorted.at(-2)?.sales ?? 0;
  const customerCount = sorted.reduce((sum, row) => sum + row.customers, 0);
  const unitPrice =
    latestDate && sorted.at(-1)?.customers ? sorted.at(-1)!.sales / sorted.at(-1)!.customers : null;
  const weekSales = sorted.slice(-7).reduce((sum, row) => sum + row.sales, 0);
  const monthSales = sorted.slice(-30).reduce((sum, row) => sum + row.sales, 0);

  return {
    rows: sorted,
    totalSales,
    latestSales,
    previousSales,
    weekSales,
    monthSales,
    changeFromPreviousDay: previousSales
      ? ((latestSales - previousSales) / previousSales) * 100
      : 0,
    labels,
    series,
    latestDate,
    customerCount,
    unitPrice,
  };
}
