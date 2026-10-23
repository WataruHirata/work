import type { DataRecord } from "@/domain/contracts";
import { fictionalSupplierForProduct } from "@/domain/order-catalog";

export const inventoryAlertThreshold = 0;

export function isInventoryAlert(row: DataRecord) {
  const quantity = row.quantity;
  if (typeof quantity !== "number" && typeof quantity !== "string") return false;
  if (typeof quantity === "string" && !quantity.trim()) return false;
  const parsed = Number(quantity);
  return Number.isFinite(parsed) && parsed <= inventoryAlertThreshold;
}

export function resolveRegisteredStoreId(
  assignedStoreIds: readonly string[],
  deviceStoreId?: string,
) {
  if (deviceStoreId?.trim()) return deviceStoreId;
  return assignedStoreIds.find((id) => id.trim().length > 0);
}

function value(record: DataRecord | undefined, key: string) {
  const current = record?.[key];
  return typeof current === "string" || typeof current === "number" ? String(current) : "";
}

export type InventoryFilters = {
  item?: string;
  category?: string;
  supplier?: string;
};

export function inventorySupplier(row: DataRecord, product?: DataRecord) {
  const registered =
    value(row, "supplier_name") ||
    value(row, "supplier") ||
    value(product, "supplier_name") ||
    value(product, "supplier");
  const code = value(row, "code") || value(product, "code");
  return registered || (code ? fictionalSupplierForProduct(code) : "未設定");
}

export function filterInventoryRows(
  rows: readonly DataRecord[],
  products: readonly DataRecord[],
  departments: readonly DataRecord[],
  filters: InventoryFilters | string,
) {
  const normalized =
    typeof filters === "string"
      ? { item: filters.trim().toLocaleLowerCase("ja-JP"), category: "", supplier: "" }
      : {
          item: (filters.item ?? "").trim().toLocaleLowerCase("ja-JP"),
          category: (filters.category ?? "").trim().toLocaleLowerCase("ja-JP"),
          supplier: (filters.supplier ?? "").trim().toLocaleLowerCase("ja-JP"),
        };

  const productById = new Map(products.map((product) => [product.id, product]));
  const departmentById = new Map(departments.map((department) => [department.id, department]));
  return rows.filter((row) => {
    const product = productById.get(value(row, "product_id"));
    const department = departmentById.get(value(row, "department_id"));
    const item = [
      value(row, "code"),
      value(row, "name"),
      value(product, "code"),
      value(product, "name"),
      value(row, "category_code"),
      value(product, "category_code"),
      value(department, "code"),
      value(department, "name"),
    ]
      .join(" ")
      .toLocaleLowerCase("ja-JP");
    const category = (
      value(row, "category_code") || value(product, "category_code")
    ).toLocaleLowerCase("ja-JP");
    const supplier = inventorySupplier(row, product).toLocaleLowerCase("ja-JP");
    return (
      (!normalized.item || item.includes(normalized.item)) &&
      (!normalized.category || category === normalized.category) &&
      (!normalized.supplier || supplier === normalized.supplier)
    );
  });
}
