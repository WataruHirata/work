import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Json } from "@/domain/contracts";
import { parseMockCoreOrder, type MockCoreOrder } from "./order-contract";

export type MockCoreOrderReceipt = {
  idempotencyKey: string;
  reference: string;
  receivedAt: string;
  order: MockCoreOrder;
};

const defaultFile = resolve(process.cwd(), ".local/mock-core-system/orders.json");
const queues = new Map<string, Promise<unknown>>();

async function readOrders(file: string): Promise<MockCoreOrderReceipt[]> {
  try {
    const value: unknown = JSON.parse(await readFile(file, "utf8"));
    return Array.isArray(value) ? (value as MockCoreOrderReceipt[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeOrders(file: string, orders: MockCoreOrderReceipt[]) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(orders, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

export async function receiveMockCoreOrder(
  idempotencyKey: string,
  payload: Json,
  file = defaultFile,
): Promise<MockCoreOrderReceipt> {
  if (!idempotencyKey || idempotencyKey.length > 191)
    throw new Error("開発用基幹システムの冪等キーが不正です。");
  const previous = queues.get(file) ?? Promise.resolve();
  let resolveQueue: () => void = () => undefined;
  const current = new Promise<void>((resolveCurrent) => {
    resolveQueue = resolveCurrent;
  });
  queues.set(
    file,
    previous.then(() => current),
  );
  await previous;
  try {
    const orders = await readOrders(file);
    const duplicate = orders.find((order) => order.idempotencyKey === idempotencyKey);
    if (duplicate) {
      const incoming = parseMockCoreOrder(payload);
      if (JSON.stringify(duplicate.order) !== JSON.stringify(incoming))
        throw new Error("同じ冪等キーで異なる発注を受信しました。");
      return duplicate;
    }
    const order = parseMockCoreOrder(payload);
    const receipt: MockCoreOrderReceipt = {
      idempotencyKey,
      reference: `MOCK-ERP-${String(orders.length + 1).padStart(6, "0")}`,
      receivedAt: new Date().toISOString(),
      order,
    };
    await writeOrders(file, [...orders, receipt]);
    return receipt;
  } finally {
    resolveQueue();
  }
}

export function listMockCoreOrders(file = defaultFile) {
  return readOrders(file);
}
