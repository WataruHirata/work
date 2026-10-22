import { describe, expect, it } from "vitest";
import { storeSummary } from "@/domain/store-summary";
describe("AT-03 実店舗集計", () => {
  it("営業日順に並べ、客単価を客数から算出しゼロ客数を区別する", () => {
    const result = storeSummary({
      store: { name: "Fictional store" },
      sales: [
        {
          business_date: "2020-01-02",
          net_sales_yen: 2000,
          customer_count: 4,
          status: "confirmed",
        },
        {
          business_date: "2020-01-01",
          net_sales_yen: 1000,
          customer_count: 0,
          status: "imported",
        },
      ],
    });
    expect(result.total).toBe(3000);
    expect(result.unitPrice).toBe(500);
    expect(result.change).toBe(100);
    expect(storeSummary({ store: { name: "Fictional" }, sales: [] }).unitPrice).toBeNull();
  });
});
