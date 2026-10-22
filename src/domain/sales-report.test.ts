import { describe, expect, it } from "vitest";
import { salesEntry, totalSales, salesBy, averageSale } from "@/domain/sales-report";
import type { DataRecord } from "@/domain/contracts";
const fixture: DataRecord = {
  id: "s1",
  store_id: "store1",
  business_date: "2026-10-22",
  status: "imported",
  net_sales_yen: "1001",
  gross_sales_yen: "1101",
  customer_count: 2,
  transaction_count: 3,
};
describe("売上集計 FR-005/006 AT-03", () => {
  it("期間合計・店舗別・日別の合計が一致する", () => {
    const rows = [
      salesEntry(fixture),
      salesEntry({
        ...fixture,
        id: "s2",
        store_id: "store2",
        net_sales_yen: "2000",
        status: "confirmed",
      }),
    ];
    expect(totalSales(rows)).toEqual({
      net: 3001n,
      gross: 2202n,
      customers: 4n,
      transactions: 6n,
      pending: 1,
    });
    expect(salesBy(rows, "date")[0].net).toBe(3001n);
    expect(salesBy(rows, "storeId").map((row) => row.net)).toEqual([1001n, 2000n]);
    expect(averageSale(3001n, 4n)).toBe(750n);
  });
  it("大きな金額と返品によるマイナス額を誤差なく集計する", () => {
    const rows = [
      salesEntry({ ...fixture, net_sales_yen: "9007199254740993" }),
      salesEntry({ ...fixture, id: "s2", net_sales_yen: "-1" }),
    ];
    expect(totalSales(rows).net).toBe(9007199254740992n);
    expect(averageSale(-1001n, 2n)).toBe(-501n);
    expect(averageSale(100n, 0n)).toBeNull();
  });
  it("MySQLの日本時間のDATEを営業日として表示する", () => {
    const row = {
      ...fixture,
      business_date: new Date("2026-10-21T15:00:00Z"),
    } as unknown as DataRecord;
    expect(salesEntry(row).date).toBe("2026-10-22");
  });
  it("不正値・安全でない数値・負の客数・不正日付を拒否する", () => {
    for (const change of [
      { net_sales_yen: null },
      { net_sales_yen: 9007199254740992 },
      { customer_count: -1 },
      { business_date: "2026-02-30" },
    ]) {
      expect(() => salesEntry({ ...fixture, ...change } as unknown as DataRecord)).toThrow();
    }
    expect(totalSales([])).toEqual({
      net: 0n,
      gross: 0n,
      customers: 0n,
      transactions: 0n,
      pending: 0,
    });
  });
});
