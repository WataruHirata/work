import "server-only";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { repository } from "@/server/container";
import { deviceToken } from "@/server/auth/store-context";
import type { DataRecord, Json } from "@/domain/contracts";
import type { OrderCatalogItem, OrderHistoryItem } from "@/components/store/order-workspace";
import { fictionalSupplierForProduct } from "@/domain/order-catalog";

function text(row: Record<string, unknown>, key: string) {
  return String(row[key] ?? "");
}

function number(row: Record<string, unknown>, key: string) {
  return Number(row[key] ?? 0);
}

function orderDate(value: unknown) {
  return String(value ?? "").slice(0, 10);
}

function rows(value: Json | undefined): DataRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) =>
    row && typeof row === "object" && !Array.isArray(row) && typeof row.id === "string"
      ? [row as DataRecord]
      : [],
  );
}

export async function orderPageData() {
  const token = await deviceToken();
  if (!token) redirect("/station");
  const workspace = await repository().storeDeviceOrderWorkspace(token);
  const store =
    workspace.store && typeof workspace.store === "object" && !Array.isArray(workspace.store)
      ? workspace.store
      : null;
  const storeId = store && typeof store.id === "string" ? store.id : null;
  if (!storeId)
    return {
      catalog: [],
      departmentId: null,
      history: [],
      requestId: randomUUID(),
      storeId: null,
      canCreateOrder: false,
      unavailableReason: "表示対象の店舗がありません。",
    };
  const orders = rows(workspace.orders);
  const lines = rows(workspace.orderLines);
  const products = rows(workspace.catalog);
  const departments = rows(workspace.departments);
  const productById = new Map(products.map((product) => [product.id, product]));
  const linesByOrder = new Map<string, DataRecord[]>();
  for (const line of lines) {
    const current = linesByOrder.get(text(line, "order_id")) ?? [];
    current.push(line);
    linesByOrder.set(text(line, "order_id"), current);
  }
  const history: OrderHistoryItem[] = orders.map((order) => {
    const orderLines = linesByOrder.get(order.id) ?? [];
    const fallbackTotal = orderLines.reduce((sum, line) => sum + number(line, "line_total_yen"), 0);
    return {
      id: order.id,
      orderDate: orderDate(order.order_date),
      requestedBy: text(order, "requested_name") || "店舗端末",
      itemNames: orderLines.map((line) =>
        text(productById.get(text(line, "product_id")) ?? {}, "name"),
      ),
      itemCount: orderLines.length,
      totalYen: number(order, "order_total_yen") || fallbackTotal,
      status: text(order, "status"),
    };
  });
  const catalog: OrderCatalogItem[] = products
    .map((product) => {
      const category = text(product, "category_code") || "その他";
      const code = text(product, "code");
      return {
        id: product.id,
        code,
        name: text(product, "name"),
        category,
        supplier: fictionalSupplierForProduct(code),
        priceYen: number(product, "price_yen"),
      };
    })
    .filter((product) => product.priceYen > 0);
  const department = departments[0];
  const unavailableReason = !department ? "発注対象の部門が登録されていません。" : null;
  return {
    catalog,
    departmentId: department?.id ?? null,
    history,
    requestId: randomUUID(),
    storeId,
    canCreateOrder: !unavailableReason,
    unavailableReason,
  };
}
