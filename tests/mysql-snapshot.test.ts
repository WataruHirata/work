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
  it("uses an id tie-breaker so paged lists remain stable", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("database/mysql/repository.ts", "utf8");
    expect(source).toContain("ORDER BY `\${spec.order}` \${order},`id` \${order}");
  });

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
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([
        [
          {
            inventory_alert_count: 2,
            notice_count: 5,
            campaign_pending_count: 3,
          },
        ],
      ]);

    const result = await new MysqlRepository().storeSnapshot(token);

    expect(execute.mock.calls[0][0]).toContain("token_hash=? AND active=1");
    expect(execute.mock.calls[0][1][0]).toEqual(createHash("sha256").update(token).digest());
    expect(execute.mock.calls[2][0]).toContain("DATE_FORMAT(business_date,'%Y-%m-%d')");
    expect(execute.mock.calls[4][0]).toContain("task.work_approved_at");
    expect(execute.mock.calls[7][0]).toContain("line.product_name_snapshot AS name");
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
    expect(result.campaigns).toEqual([]);
    expect(result.salesComposition).toEqual([]);
    expect(result.metrics).toEqual({
      inventory_alert_count: 2,
      notice_count: 5,
      campaign_pending_count: 3,
    });
    expect(execute).toHaveBeenCalledTimes(9);
  });
});
