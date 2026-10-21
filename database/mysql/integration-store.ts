import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { IntegrationJob, IntegrationJobStore, Json, NormalPriceQuote } from "@/domain/contracts";
import { mysqlPool, mysqlTransaction } from "./pool";
import type { RowDataPacket } from "mysql2/promise";

export class MysqlIntegrationStore implements IntegrationJobStore {
  async claim(kinds: string[], limit: number): Promise<IntegrationJob[]> {
    if (!kinds.length) return [];
    return mysqlTransaction(async (db) => {
      const [rows] = await db.execute<(RowDataPacket & { id: string; kind: string; idempotency_key: string; payload: Json })[]>(
        `SELECT id,kind,idempotency_key,payload FROM integration_jobs WHERE kind IN (${kinds.map(() => "?").join(",")}) AND ((status IN ('pending','failed') AND available_at<=CURRENT_TIMESTAMP(3)) OR (status='processing' AND locked_until<CURRENT_TIMESTAMP(3))) ORDER BY available_at,created_at LIMIT ? FOR UPDATE SKIP LOCKED`,
        [...kinds, Math.max(1, Math.min(100, Math.trunc(limit)))],
      );
      const jobs: IntegrationJob[] = [];
      for (const row of rows) {
        const leaseId = randomUUID();
        await db.execute("UPDATE integration_jobs SET status='processing',attempts=attempts+1,lease_id=?,locked_until=DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 2 MINUTE),updated_at=CURRENT_TIMESTAMP(3) WHERE id=?", [leaseId, row.id]);
        jobs.push({ id: row.id, kind: row.kind, idempotencyKey: row.idempotency_key, payload: typeof row.payload === "string" ? JSON.parse(row.payload) as Json : row.payload, leaseId });
      }
      return jobs;
    });
  }
  async finish(job: IntegrationJob, success: boolean, result: Json, error?: string) {
    const [updated] = await mysqlPool().execute(
      `UPDATE integration_jobs SET status=?,result=?,last_error=?,locked_until=NULL,available_at=IF(?,available_at,DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL LEAST(attempts,8) MINUTE)),updated_at=CURRENT_TIMESTAMP(3) WHERE id=? AND status='processing' AND lease_id=?`,
      [success ? "completed" : "failed", JSON.stringify(result), error ?? null, success, job.id, job.leaseId],
    );
    if (!(updated as { affectedRows: number }).affectedRows) throw new Error("連携ジョブのleaseが無効です。再取得して処理してください。");
  }
  async restorePrice(productId: string, storeId: string): Promise<NormalPriceQuote | null> {
    const [rows] = await mysqlPool().execute<(RowDataPacket & { price_yen: number; valid_from: Date })[]>("SELECT price_yen,valid_from FROM product_prices WHERE product_id=? AND (store_id=? OR store_id IS NULL) AND valid_from<=CURRENT_TIMESTAMP(3) AND (valid_until IS NULL OR valid_until>CURRENT_TIMESTAMP(3)) ORDER BY (store_id IS NOT NULL) DESC,valid_from DESC LIMIT 1", [productId, storeId]);
    const row = rows[0];
    return row ? { priceYen: Number(row.price_yen), revision: row.valid_from.toISOString() } : null;
  }
  async promotionEligible(productId: string): Promise<boolean> {
    const [rows] = await mysqlPool().execute<(RowDataPacket & { eligible: number })[]>("SELECT (active=1 AND promotion_eligibility='eligible') AS eligible FROM products WHERE id=?", [productId]);
    return Boolean(rows[0]?.eligible);
  }
  async ingest(eventId: string, kind: string, rows: Json[]): Promise<Json> {
    if (!eventId || eventId.length > 200 || rows.length < 1 || rows.length > 10000) throw new Error("取込イベントの形式が不正です。");
    if (!["inventory", "prices"].includes(kind)) throw new Error("MySQLの売上インポートは業務取込コマンドへ移植中です。");
    const hash = createHash("sha256").update(`${kind}${JSON.stringify(rows)}`).digest();
    return mysqlTransaction(async (db) => {
      const [old] = await db.execute<(RowDataPacket & { content_hash: Buffer })[]>("SELECT content_hash FROM integration_receipts WHERE event_id=? FOR UPDATE", [eventId]);
      if (old.length) {
        if (!Buffer.from(old[0].content_hash).equals(hash)) throw new Error("同じイベントIDに異なる内容が届きました。");
        return { duplicate: true } as Json;
      }
      await db.execute("INSERT INTO integration_receipts(event_id,content_hash,kind) VALUES(?,?,?)", [eventId, hash, kind]);
      for (const value of rows) {
        if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("取込行の形式が不正です。");
        if (kind === "inventory") {
          const item = value as Record<string, Json>;
          const observed = new Date(String(item.observed_at));
          if (Number.isNaN(observed.valueOf()) || observed > new Date()) throw new Error("在庫観測時刻を確認してください。");
          await db.execute("INSERT INTO inventory_snapshots(id,store_id,department_id,product_id,quantity,observed_at,source_reference) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE quantity=IF(VALUES(observed_at)>=observed_at,VALUES(quantity),quantity),source_reference=IF(VALUES(observed_at)>=observed_at,VALUES(source_reference),source_reference),observed_at=GREATEST(observed_at,VALUES(observed_at))", [randomUUID(), item.store_id, item.department_id, item.product_id, item.quantity, observed, item.source_reference]);
        } else {
          const item = value as Record<string, Json>;
          if (!["eligible", "excluded", "not_configured"].includes(String(item.promotion_eligibility))) throw new Error("商品分類が不正です。");
          await db.execute("INSERT INTO product_prices(id,product_id,store_id,price_yen,valid_from,valid_until) VALUES(?,?,?,?,?,?)", [randomUUID(), item.product_id, item.store_id ?? null, item.price_yen, item.valid_from, item.valid_until ?? null]);
          await db.execute("UPDATE products SET promotion_eligibility=?,updated_at=CURRENT_TIMESTAMP(3) WHERE id=?", [item.promotion_eligibility, item.product_id]);
        }
      }
      return { duplicate: false, rows: rows.length } as Json;
    });
  }
}
