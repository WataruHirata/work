import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listMockCoreOrders, receiveMockCoreOrder } from "./order-store";

const directories: string[] = [];
const payload = {
  orderId: "10000000-0000-4000-8000-000000000001",
  storeCode: "MOCK-STORE-001",
  departmentCode: "MOCK-DELI",
  deliveryDate: "2026-10-30",
  totalYen: 792,
  items: [
    {
      productId: "20000000-0000-4000-8000-000000000001",
      productCode: "MOCK-FOOD-001",
      quantity: 4,
      unitPriceYen: 198,
      lineTotalYen: 792,
    },
  ],
};

async function fixtureFile() {
  const directory = await mkdtemp(join(tmpdir(), "minoriya-mock-core-"));
  directories.push(directory);
  return join(directory, "orders.json");
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("開発用基幹システムの発注受付", () => {
  it("発注を保存し、同じ冪等キーの再送には同じ受付結果を返す", async () => {
    const file = await fixtureFile();
    const first = await receiveMockCoreOrder("order:fictional-request", payload, file);
    const replay = await receiveMockCoreOrder("order:fictional-request", payload, file);

    expect(replay).toEqual(first);
    expect(first.reference).toBe("MOCK-ERP-000001");
    expect(await listMockCoreOrders(file)).toEqual([first]);
  });

  it("合計不一致と同一キーの異なる内容を拒否する", async () => {
    const file = await fixtureFile();
    await expect(
      receiveMockCoreOrder("order:invalid-total", { ...payload, totalYen: 791 }, file),
    ).rejects.toThrow("発注内容が不正");
    await receiveMockCoreOrder("order:conflict", payload, file);
    await expect(
      receiveMockCoreOrder("order:conflict", { ...payload, deliveryDate: "2026-10-31" }, file),
    ).rejects.toThrow("同じ冪等キー");
  });
});
