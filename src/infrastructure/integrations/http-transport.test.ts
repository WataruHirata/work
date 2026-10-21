import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { HttpIntegrationTransport } from "./http-transport";
const targets = {
  order: {
    url: "https://fictional.invalid/order",
    token: "synthetic-test-token",
  },
  campaign_restore: {
    url: "https://fictional.invalid/price",
    token: "synthetic-test-token",
  },
};
describe("AT-07/09 外部HTTP契約", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("同じ識別子の明示的な受付応答のみを成功とする", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        ok: true,
        idempotencyKey: "fictional-key",
        reference: "fictional-result",
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(
      await new HttpIntegrationTransport(targets).send(
        "order",
        "fictional-key",
        {},
      ),
    ).toMatchObject({ ok: true, reference: "fictional-result" });
    expect(fetcher.mock.calls[0][1].redirect).toBe("error");
    expect(fetcher.mock.calls[0][1].headers["idempotency-key"]).toBe(
      "fictional-key",
    );
  });
  it("別要求の応答・古い通常売価版・価格違いを成功扱いしない", async () => {
    for (const response of [
      {
        ok: true,
        idempotencyKey: "another-key",
        reference: "fictional-result",
        appliedPriceYen: 120,
        normalPriceRevision: "v2",
      },
      {
        ok: true,
        idempotencyKey: "fictional-key",
        reference: "fictional-result",
        appliedPriceYen: 100,
        normalPriceRevision: "v2",
      },
      {
        ok: true,
        idempotencyKey: "fictional-key",
        reference: "fictional-result",
        appliedPriceYen: 120,
        normalPriceRevision: "v1",
      },
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(Response.json(response)),
      );
      await expect(
        new HttpIntegrationTransport(targets).send(
          "campaign_restore",
          "fictional-key",
          { priceYen: 120, normalPriceRevision: "v2" },
        ),
      ).rejects.toThrow();
    }
  });
  it("不正応答の本文をエラーメッセージへ転載しない", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("fictional-private-response")),
    );
    await expect(
      new HttpIntegrationTransport(targets).send("order", "fictional-key", {}),
    ).rejects.toThrow("外部APIの応答を解析できません。");
  });
  it("ProductionではHTTP・URL内認証情報・クエリー付きの送信先を拒否する", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    for (const url of [
      "http://fictional.invalid/order",
      "https://user:synthetic@fictional.invalid/order",
      "https://fictional.invalid/order?credential=synthetic",
    ]) {
      await expect(
        new HttpIntegrationTransport({
          order: { url, token: "synthetic-test-token" },
        }).send("order", "fictional-key", {}),
      ).rejects.toThrow("URL設定");
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});
