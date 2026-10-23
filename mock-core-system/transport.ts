import "server-only";

import type { IntegrationTransport, Json } from "@/domain/contracts";
import { receiveMockCoreOrder } from "./order-store";

export class MockCoreSystemTransport implements IntegrationTransport {
  constructor(private fallback?: IntegrationTransport) {}

  async send(kind: string, idempotencyKey: string, payload: Json): Promise<Json> {
    if (kind !== "order") {
      if (!this.fallback) throw new Error(`開発用基幹システムは ${kind} 連携に対応していません。`);
      return this.fallback.send(kind, idempotencyKey, payload);
    }
    const receipt = await receiveMockCoreOrder(idempotencyKey, payload);
    return {
      ok: true,
      idempotencyKey,
      reference: receipt.reference,
      receivedAt: receipt.receivedAt,
    };
  }
}
