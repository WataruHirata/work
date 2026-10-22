import type { DataRecord } from "@/domain/contracts";

export type SalesEntry = {
  id: string;
  storeId: string;
  date: string;
  status: string;
  net: bigint;
  gross: bigint;
  customers: bigint;
  transactions: bigint;
};

function amount(value: unknown, nonnegative = false): bigint {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    !/^-?\d+$/.test(String(value)) ||
    (typeof value === "number" && !Number.isSafeInteger(value))
  )
    throw new Error("売上の集計値が不正です。");
  const result = BigInt(value);
  if (nonnegative && result < 0n) throw new Error("客数・取引数が不正です。");
  return result;
}

export function salesEntry(row: DataRecord): SalesEntry {
  // SQL DATE returned as a Date by MySQL represents local midnight in Japan.
  const rawDate: unknown = row.business_date;
  const date =
    rawDate instanceof Date
      ? new Date(rawDate.getTime() + 9 * 3600000).toISOString().slice(0, 10)
      : String(rawDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0, 10) !== date)
    throw new Error("営業日が不正です。");
  return {
    id: row.id,
    storeId: String(row.store_id),
    date,
    status: String(row.status),
    net: amount(row.net_sales_yen),
    gross: amount(row.gross_sales_yen),
    customers: amount(row.customer_count, true),
    transactions: amount(row.transaction_count, true),
  };
}

export function totalSales(entries: readonly SalesEntry[]) {
  return entries.reduce(
    (sum, row) => ({
      net: sum.net + row.net,
      gross: sum.gross + row.gross,
      customers: sum.customers + row.customers,
      transactions: sum.transactions + row.transactions,
      pending: sum.pending + (row.status === "imported" ? 1 : 0),
    }),
    { net: 0n, gross: 0n, customers: 0n, transactions: 0n, pending: 0 },
  );
}

export function salesBy(entries: readonly SalesEntry[], key: "date" | "storeId") {
  const groups = new Map<string, SalesEntry[]>();
  for (const row of entries) groups.set(row[key], [...(groups.get(row[key]) ?? []), row]);
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, rows]) => ({ id, ...totalSales(rows) }));
}

export function averageSale(net: bigint, customers: bigint): bigint | null {
  if (!customers) return null;
  const absolute = net < 0n ? -net : net;
  const rounded = (absolute * 2n + customers) / (customers * 2n);
  return net < 0n ? -rounded : rounded;
}
