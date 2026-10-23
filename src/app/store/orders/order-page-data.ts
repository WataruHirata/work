import "server-only";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { allRecords } from "@/server/queries/workspaces";
import { identity } from "@/server/container";
import type { DataRecord } from "@/domain/contracts";
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

export async function orderPageData() {
  const session = await identity().session();
  if (!session?.active) redirect("/login?next=%2Fstore%2Forders");
  if (session.mustChangePassword) redirect("/account/password");
  const stores = await allRecords("stores");
  const assignedStoreId = session.storeIds?.[0];
  const assignedStore = stores.find(
    (store) => store.id === assignedStoreId && String(store.status) === "active",
  );
  const storeId =
    assignedStore?.id ?? stores.find((store) => String(store.status) === "active")?.id;
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
  const [orders, lines, products, prices, departments, users] = await Promise.all([
    allRecords("orders", { storeId }),
    allRecords("orderLines", { storeId }),
    allRecords("products"),
    allRecords("prices"),
    allRecords("departments", { storeId }),
    allRecords("users"),
  ]);
  const productById = new Map(products.map((product) => [product.id, product]));
  const userById = new Map(users.map((user) => [user.id, text(user, "display_name")]));
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
      requestedBy: userById.get(text(order, "requested_by")) ?? session.displayName,
      itemNames: orderLines.map((line) =>
        text(productById.get(text(line, "product_id")) ?? {}, "name"),
      ),
      itemCount: orderLines.length,
      totalYen: number(order, "order_total_yen") || fallbackTotal,
      status: text(order, "status"),
    };
  });
  const priceFor = (productId: string) => {
    const candidates = prices
      .filter((price) => text(price, "product_id") === productId)
      .filter((price) => !price.store_id || text(price, "store_id") === storeId)
      .sort((left, right) => {
        const storeDifference =
          Number(text(right, "store_id") === storeId) - Number(text(left, "store_id") === storeId);
        return storeDifference || text(right, "valid_from").localeCompare(text(left, "valid_from"));
      });
    return number(candidates[0] ?? {}, "price_yen");
  };
  const catalog: OrderCatalogItem[] = products
    .filter((product) => Boolean(product.active))
    .map((product) => {
      const category = text(product, "category_code") || "その他";
      const code = text(product, "code");
      return {
        id: product.id,
        code,
        name: text(product, "name"),
        category,
        supplier: fictionalSupplierForProduct(code),
        priceYen: priceFor(product.id),
      };
    })
    .filter((product) => product.priceYen > 0);
  const department = departments.find((candidate) => Boolean(candidate.active));
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
