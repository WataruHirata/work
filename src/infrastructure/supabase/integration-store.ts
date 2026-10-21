import "server-only";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/clients/admin";
import type { IntegrationJobStore, IntegrationJob, Json, NormalPriceQuote } from "@/domain/contracts";

export class SupabaseIntegrationStore implements IntegrationJobStore {
  private client() {
    const client = createSupabaseAdminClient();
    if (!client) throw new Error("外部連携用のサーバー認証設定がありません。");
    return client;
  }
  async claim(kinds: string[], limit: number): Promise<IntegrationJob[]> {
    const { data, error } = await this.client().rpc("claim_integration_jobs", { p_kinds: kinds, p_limit: limit });
    if (error) throw new Error("連携待ちデータを取得できませんでした。");
    return (data ?? []).map((row: { id: string; kind: string; idempotency_key: string; payload: Json; lease_id: string }) => ({ id: row.id, kind: row.kind, idempotencyKey: row.idempotency_key, payload: row.payload, leaseId: row.lease_id }));
  }
  async finish(job: IntegrationJob, success: boolean, result: Json, errorMessage?: string) {
    const { error } = await this.client().rpc("finish_integration_job", { p_job_id: job.id, p_lease_id: job.leaseId, p_success: success, p_result: result, p_error: errorMessage ?? null });
    if (error) throw new Error("連携結果を確定できませんでした。処理識別子を確認して再処理してください。");
  }
  async restorePrice(productId: string, storeId: string): Promise<NormalPriceQuote | null> {
    const { data, error } = await this.client().rpc("resolve_restore_price_quote", { p_product_id: productId, p_store_id: storeId });
    if (error) throw new Error("通常売価の参照に失敗しました。");
    return data && typeof data.priceYen === "number" && typeof data.revision === "string" ? data as NormalPriceQuote : null;
  }
  async promotionEligible(productId: string): Promise<boolean> {
    const { data, error } = await this.client().from("products").select("active,promotion_eligibility").eq("id", productId).maybeSingle();
    if (error) throw new Error("最新の特売対象区分を確認できません。");
    return Boolean(data?.active && data.promotion_eligibility === "eligible");
  }
  async ingest(eventId: string, kind: string, rows: Json[]): Promise<Json> {
    const { data, error } = await this.client().rpc("ingest_external_snapshot", { p_event_id: eventId, p_kind: kind, p_rows: rows });
    if (error) throw new Error("データ形式・参照マスタ・イベントの重複内容を確認してください。");
    return data as Json;
  }
}
