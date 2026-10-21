import "server-only";
import type { IntegrationTransport, Json } from "@/domain/contracts";
import { readBoundedJson } from "./bounded-json";

type Target = { url?: string; token?: string };
export function configuredTargets(): Record<string, Target> {
  return { order: { url: process.env.ERP_ORDER_API_URL, token: process.env.ERP_API_TOKEN }, campaign_price: { url: process.env.POS_PRICE_API_URL, token: process.env.POS_API_TOKEN }, campaign_restore: { url: process.env.POS_PRICE_API_URL, token: process.env.POS_API_TOKEN } };
}
export class HttpIntegrationTransport implements IntegrationTransport {
  constructor(private targets: Record<string, Target>) {}
  async send(kind: string, idempotencyKey: string, payload: Json): Promise<Json> {
    const target = this.targets[kind];
    if (!target?.url || !target.token) throw new Error("外部APIの接続設定がありません。");
    const url = new URL(target.url);
    if ((process.env.NODE_ENV === "production" && url.protocol !== "https:") || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("外部APIのURL設定を確認してください。");
    const response = await fetch(url, { method: "POST", redirect: "error", headers: { "content-type": "application/json", authorization: `Bearer ${target.token}`, "idempotency-key": idempotencyKey }, body: JSON.stringify({ version: 1, kind, idempotencyKey, payload }), signal: AbortSignal.timeout(15000), cache: "no-store" });
    if (!response.ok) throw new Error(`外部APIがHTTP ${response.status}を返しました。`);
    let body: unknown;
    try { body = await readBoundedJson(response, 64000); } catch { throw new Error("外部APIの応答を解析できません。"); }
    if (!body || typeof body !== "object" || !("ok" in body) || body.ok !== true || !("idempotencyKey" in body) || body.idempotencyKey !== idempotencyKey || !("reference" in body) || typeof body.reference !== "string" || !body.reference.trim() || body.reference.length > 200) throw new Error("外部APIの処理識別子または結果形式が一致しません。");
    const input = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
    if (kind.startsWith("campaign_") && (!("appliedPriceYen" in body) || body.appliedPriceYen !== input.priceYen)) throw new Error("外部APIで確認された価格が送信価格と一致しません。");
    if (kind === "campaign_restore" && (!("normalPriceRevision" in body) || body.normalPriceRevision !== input.normalPriceRevision)) throw new Error("外部APIで確認された通常売価の版が一致しません。");
    return { ok: true, idempotencyKey, reference: body.reference, ...(kind.startsWith("campaign_") ? { appliedPriceYen: input.priceYen } : {}), ...(kind === "campaign_restore" ? { normalPriceRevision: input.normalPriceRevision } : {}) };
  }
}
