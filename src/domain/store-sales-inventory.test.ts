import { describe, expect, it } from "vitest";
import type { DataRecord } from "@/domain/contracts";
import { filterInventoryRows, resolveRegisteredStoreId } from "@/domain/store-sales-inventory";

describe("店舗売上・在庫の対象と検索", () => {
  it("URL由来の店舗選択を使わず、担当店舗を優先し端末登録店舗へフォールバックする", () => {
    expect(resolveRegisteredStoreId(["store-a", "store-b"], "device-store")).toBe("device-store");
    expect(resolveRegisteredStoreId(["store-a", "store-b"], undefined)).toBe("store-a");
    expect(resolveRegisteredStoreId([], "device-store")).toBe("device-store");
    expect(resolveRegisteredStoreId([], undefined)).toBeUndefined();
  });

  it("品目コード、商品名、分類、売場名で在庫行を絞り込む", () => {
    const rows: DataRecord[] = [
      { id: "stock-1", product_id: "product-1", department_id: "department-1" },
      { id: "stock-2", product_id: "product-2", department_id: "department-2" },
    ];
    const products: DataRecord[] = [
      { id: "product-1", code: "A-001", name: "りんご", category_code: "青果" },
      { id: "product-2", code: "B-002", name: "牛乳", category_code: "日配" },
    ];
    const departments: DataRecord[] = [
      { id: "department-1", code: "D-01", name: "青果売場" },
      { id: "department-2", code: "D-02", name: "日配売場" },
    ];

    expect(filterInventoryRows(rows, products, departments, "りんご").map((row) => row.id)).toEqual(
      ["stock-1"],
    );
    expect(filterInventoryRows(rows, products, departments, "B-002").map((row) => row.id)).toEqual([
      "stock-2",
    ]);
    expect(filterInventoryRows(rows, products, departments, "青果").map((row) => row.id)).toEqual([
      "stock-1",
    ]);
    expect(
      filterInventoryRows(rows, products, departments, "日配売場").map((row) => row.id),
    ).toEqual(["stock-2"]);
  });

  it("品目、種別、業者を組み合わせて在庫行を絞り込む", () => {
    const rows: DataRecord[] = [
      { id: "stock-1", product_id: "product-1", supplier_name: "青果卸A" },
      { id: "stock-2", product_id: "product-2", supplier_name: "日配卸B" },
    ];
    const products: DataRecord[] = [
      { id: "product-1", code: "A-001", name: "りんご", category_code: "青果" },
      { id: "product-2", code: "B-002", name: "牛乳", category_code: "日配" },
    ];

    expect(
      filterInventoryRows(rows, products, [], {
        item: "りんご",
        category: "青果",
        supplier: "青果卸A",
      }).map((row) => row.id),
    ).toEqual(["stock-1"]);
    expect(
      filterInventoryRows(rows, products, [], { supplier: "日配卸B" }).map((row) => row.id),
    ).toEqual(["stock-2"]);
  });
});
