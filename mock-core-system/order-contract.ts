import type { Json } from "@/domain/contracts";

export type MockCoreOrderLine = {
  productId: string;
  productCode: string;
  quantity: number;
  unitPriceYen: number;
  lineTotalYen: number;
};

export type MockCoreOrder = {
  orderId: string;
  storeCode: string;
  departmentCode: string;
  deliveryDate: string;
  totalYen: number;
  items: MockCoreOrderLine[];
};

function record(value: Json): Record<string, Json> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("開発用基幹システムへ送信する発注データの形式が不正です。");
  return value;
}

export function parseMockCoreOrder(value: Json): MockCoreOrder {
  const input = record(value);
  const items = input.items;
  if (!Array.isArray(items) || !items.length || items.length > 500)
    throw new Error("開発用基幹システムへ送信する発注明細が不正です。");
  const order: MockCoreOrder = {
    orderId: String(input.orderId ?? ""),
    storeCode: String(input.storeCode ?? ""),
    departmentCode: String(input.departmentCode ?? ""),
    deliveryDate: String(input.deliveryDate ?? ""),
    totalYen: Number(input.totalYen),
    items: items.map((item) => {
      const line = record(item);
      return {
        productId: String(line.productId ?? ""),
        productCode: String(line.productCode ?? ""),
        quantity: Number(line.quantity),
        unitPriceYen: Number(line.unitPriceYen),
        lineTotalYen: Number(line.lineTotalYen),
      };
    }),
  };
  if (
    !/^[0-9a-f-]{36}$/i.test(order.orderId) ||
    !order.storeCode ||
    !order.departmentCode ||
    !/^\d{4}-\d{2}-\d{2}$/.test(order.deliveryDate) ||
    !Number.isSafeInteger(order.totalYen) ||
    order.totalYen < 0 ||
    order.items.some(
      (item) =>
        !/^[0-9a-f-]{36}$/i.test(item.productId) ||
        !item.productCode ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        !Number.isSafeInteger(item.unitPriceYen) ||
        item.unitPriceYen < 0 ||
        item.lineTotalYen !== item.unitPriceYen * item.quantity,
    ) ||
    order.items.reduce((sum, item) => sum + item.lineTotalYen, 0) !== order.totalYen
  )
    throw new Error("開発用基幹システムへ送信する発注内容が不正です。");
  return order;
}
