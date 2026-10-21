import { describe, expect, it, vi } from "vitest";
import { runIntegrationBatch } from "@/server/integrations/worker";
import type { IntegrationJob, IntegrationJobStore } from "@/domain/contracts";
function fixture(job: IntegrationJob) {
  const store: IntegrationJobStore = {
    claim: vi.fn().mockResolvedValue([job]),
    finish: vi.fn().mockResolvedValue(undefined),
    restorePrice: vi
      .fn()
      .mockResolvedValue({ priceYen: 120, revision: "2020-01-01T00:00:00Z" }),
    promotionEligible: vi.fn().mockResolvedValue(true),
    ingest: vi.fn(),
  };
  const transport = {
    send: vi
      .fn()
      .mockResolvedValue({ ok: true, reference: "fictional-result" }),
  };
  return { store, transport };
}
describe("AT-07/09 外部API境界", () => {
  it("未設定ではキューを取得せず成功を偽装しない", async () => {
    const { store, transport } = fixture({} as IntegrationJob);
    expect(await runIntegrationBatch(store, transport, [])).toMatchObject({
      unconfigured: true,
      claimed: 0,
    });
    expect(store.claim).not.toHaveBeenCalled();
    expect(transport.send).not.toHaveBeenCalled();
  });
  it("終了済みの特売をPOSに適用せず失敗として残す", async () => {
    const job = {
      id: "fictional-job",
      kind: "campaign_price",
      idempotencyKey: "fictional-key",
      leaseId: "fictional-lease",
      payload: { endsAt: "2020-01-01T00:00:00Z" },
    };
    const { store, transport } = fixture(job);
    expect(
      await runIntegrationBatch(
        store,
        transport,
        ["campaign_price"],
        new Date("2020-01-02T00:00:00Z"),
      ),
    ).toMatchObject({ failed: 1 });
    expect(transport.send).not.toHaveBeenCalled();
    expect(store.finish).toHaveBeenCalledWith(
      job,
      false,
      null,
      expect.any(String),
    );
  });
  it("実行時の最新通常売価で復帰し、操作者の内部IDを外部へ送らない", async () => {
    const job = {
      id: "fictional-job",
      kind: "campaign_restore",
      idempotencyKey: "fictional-key",
      leaseId: "fictional-lease",
      payload: {
        productId: "fictional-product",
        storeId: "fictional-store",
        requestedBy: "fictional-actor",
        request: [],
        priceYen: 100,
      },
    };
    const { store, transport } = fixture(job);
    await runIntegrationBatch(store, transport, ["campaign_restore"]);
    expect(store.restorePrice).toHaveBeenCalledWith(
      "fictional-product",
      "fictional-store",
    );
    expect(transport.send).toHaveBeenCalledWith(
      "campaign_restore",
      "fictional-key:2020-01-01T00:00:00Z",
      {
        productId: "fictional-product",
        storeId: "fictional-store",
        priceYen: 120,
        normalPriceRevision: "2020-01-01T00:00:00Z",
      },
    );
    expect(store.finish).toHaveBeenCalledWith(job, true, {
      ok: true,
      reference: "fictional-result",
    });
  });
  it("通常売価が不明・競合している場合は0円等へ置き換えず失敗にする", async () => {
    const job = {
      id: "fictional-job",
      kind: "campaign_restore",
      idempotencyKey: "fictional-key",
      leaseId: "fictional-lease",
      payload: { productId: "fictional-product", storeId: "fictional-store" },
    };
    const { store, transport } = fixture(job);
    vi.mocked(store.restorePrice).mockResolvedValue(null);
    expect(
      await runIntegrationBatch(store, transport, ["campaign_restore"]),
    ).toMatchObject({ failed: 1 });
    expect(transport.send).not.toHaveBeenCalled();
  });
  it("外部応答後にDB確定が失敗しても、別の失敗確定で上書きしない", async () => {
    const job = {
      id: "fictional-job",
      kind: "order",
      idempotencyKey: "fictional-key",
      leaseId: "fictional-lease",
      payload: { orderId: "fictional-order" },
    };
    const { store, transport } = fixture(job);
    vi.mocked(store.finish).mockRejectedValue(
      new Error("Synthetic persistence failure"),
    );
    await expect(
      runIntegrationBatch(store, transport, ["order"]),
    ).rejects.toThrow("Synthetic persistence failure");
    expect(store.finish).toHaveBeenCalledTimes(1);
  });
});
