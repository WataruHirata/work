import type {
  IntegrationJobStore,
  IntegrationTransport,
  Json,
} from "@/domain/contracts";

export async function runIntegrationBatch(
  store: IntegrationJobStore,
  transport: IntegrationTransport,
  kinds: string[],
  now = new Date(),
) {
  if (!kinds.length)
    return { claimed: 0, completed: 0, failed: 0, unconfigured: true };
  const jobs = await store.claim(kinds, 4);
  const results = await Promise.all(
    jobs.map(async (job) => {
      let result: Json;
      try {
        if (
          !job.payload ||
          typeof job.payload !== "object" ||
          Array.isArray(job.payload)
        )
          throw new Error("連携データの形式が不正です。");
        const payload = { ...job.payload };
        let externalKey = job.idempotencyKey;
        delete payload.requestedBy;
        delete payload.request;
        if (
          job.kind === "campaign_price" &&
          (!Number.isFinite(Date.parse(String(payload.endsAt))) ||
            Date.parse(String(payload.endsAt)) <= now.getTime())
        )
          throw new Error("特売期間が終了しているため適用を停止しました。");
        if (
          job.kind === "campaign_price" &&
          !(await store.promotionEligible(String(payload.productId)))
        )
          throw new Error(
            "現在の既存マスタで特売対象と確認できないため送信を停止しました。",
          );
        if (job.kind === "campaign_restore") {
          const price = await store.restorePrice(
            String(payload.productId),
            String(payload.storeId),
          );
          if (
            price === null ||
            !Number.isSafeInteger(price.priceYen) ||
            price.priceYen < 0 ||
            !Number.isFinite(Date.parse(price.revision))
          )
            throw new Error(
              "現在有効な通常売価を参照できません。既存マスタ連携を確認してください。",
            );
          payload.priceYen = price.priceYen;
          payload.normalPriceRevision = price.revision;
          externalKey = `${job.idempotencyKey}:${price.revision}`;
        }
        result = await transport.send(job.kind, externalKey, payload);
      } catch (error) {
        await store.finish(
          job,
          false,
          null,
          error instanceof Error
            ? error.message.slice(0, 500)
            : "外部連携に失敗しました。",
        );
        return false;
      }
      // A persistence failure must not be misreported as an external API failure.
      // The lease will expire and the same idempotency key will be used on recovery.
      await store.finish(job, true, result);
      return true;
    }),
  );
  return {
    claimed: jobs.length,
    completed: results.filter(Boolean).length,
    failed: results.filter((success) => !success).length,
    unconfigured: false,
  };
}
