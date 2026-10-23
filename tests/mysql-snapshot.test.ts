import { beforeEach, describe, expect, it, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@database/mock/pglite/adapter", () => ({ tableSpecs: {} }));
vi.mock("./../database/mysql/pool", () => ({
  mysqlPool: () => ({ execute }),
  mysqlTransaction: vi.fn(),
}));

import { createHash } from "node:crypto";
import { MysqlRepository } from "../database/mysql/repository";

describe("MySQL store-device snapshot", () => {
  beforeEach(() => execute.mockReset());

  it("rejects malformed device codes before querying MySQL", async () => {
    await expect(new MysqlRepository().storeSnapshot("bad-code")).rejects.toThrow("店舗端末コード");
    expect(execute).not.toHaveBeenCalled();
  });

  it("loads the scoped store snapshot using only an active token hash", async () => {
    const token = "a".repeat(64);
    const observedAt = new Date("2026-10-21T01:00:00.000Z");
    execute
      .mockResolvedValueOnce([[{ store_id: "store-1" }]])
      .mockResolvedValueOnce([[{ id: "store-1", code: "S001", name: "架空店" }]])
      .mockResolvedValueOnce([
        [
          {
            id: "day-1",
            business_date: "2026-10-20",
            status: "confirmed",
            net_sales_yen: 1200,
            customer_count: 4,
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            code: "P001",
            name: "架空商品",
            quantity: 3,
            observed_at: observedAt,
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            id: "campaign-1",
            name: "週末特売",
            product_code: "P001",
            product_name: "架空商品",
            price_yen: 198,
          },
        ],
      ])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);

    const result = await new MysqlRepository().storeSnapshot(token);

    expect(execute.mock.calls[0][0]).toContain("token_hash=? AND active=1");
    expect(execute.mock.calls[0][1][0]).toEqual(createHash("sha256").update(token).digest());
    expect(execute.mock.calls[2][0]).toContain("DATE_FORMAT(business_date,'%Y-%m-%d')");
    expect(result.store).toEqual({
      id: "store-1",
      code: "S001",
      name: "架空店",
    });
    expect(result.sales).toHaveLength(1);
    expect(result.inventory).toEqual([
      {
        code: "P001",
        name: "架空商品",
        quantity: 3,
        observed_at: observedAt.toISOString(),
      },
    ]);
    expect(execute.mock.calls[4][0]).toContain("campaign_item_store_tasks");
    expect(result.campaigns).toEqual([
      {
        id: "campaign-1",
        name: "週末特売",
        product_code: "P001",
        product_name: "架空商品",
        price_yen: 198,
      },
    ]);
    expect(execute).toHaveBeenCalledTimes(8);
  });
});
