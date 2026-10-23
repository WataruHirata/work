import type { DataRecord } from "@/domain/contracts";

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

export function filterInventoryRows(
  rows: readonly DataRecord[],
  products: readonly DataRecord[],
  departments: readonly DataRecord[],
  term: string,
) {
  const normalizedTerm = term.trim().toLocaleLowerCase("ja-JP");
  if (!normalizedTerm) return [...rows];

  const productById = new Map(products.map((product) => [product.id, product]));
  const departmentById = new Map(departments.map((department) => [department.id, department]));
  return rows.filter((row) => {
    const product = productById.get(value(row, "product_id"));
    const department = departmentById.get(value(row, "department_id"));
    const searchable = [
      value(row, "code"),
      value(row, "name"),
      value(product, "code"),
      value(product, "name"),
      value(product, "category_code"),
      value(department, "code"),
      value(department, "name"),
    ]
      .join(" ")
      .toLocaleLowerCase("ja-JP");
    return searchable.includes(normalizedTerm);
  });
}
