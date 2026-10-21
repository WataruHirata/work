import { randomUUID } from "node:crypto";
import { allRecords } from "@/server/queries/workspaces";
import { InstructionForm, InstructionConfirmation } from "@/components/campaigns/instruction-form";

export async function InstructionWorkspace({ canManage = false }: { canManage?: boolean }) {
  const [instructions, targets, stores, products] = await Promise.all([allRecords("instructions"), allRecords("instructionTargets"), allRecords("stores"), allRecords("products")]);
  const name = (id: unknown, rows: typeof stores) => String(rows.find((row) => row.id === id)?.name ?? "参照権限のない項目");
  return <section className="instruction-workspace">
    <h2>本部からの特売・価格変更指示</h2><p className="muted">指示の通知と店舗確認を管理します。指示価格はPOS・通常売価マスタへの反映結果とは別に表示します。</p>
    {canManage && <details><summary>変更指示を作成する</summary><InstructionForm requestId={randomUUID()} stores={stores.filter((s) => s.status === "active").map((s) => ({ id: s.id, name: String(s.name) }))} products={products.filter((p) => p.active).map((p) => ({ id: p.id, name: String(p.name) }))} /></details>}
    {!instructions.length && <p>現在、対象の変更指示はありません。</p>}
    {instructions.map((instruction) => <article className="instruction-card" key={instruction.id}>
      <span className="status">{instruction.kind === "promotion" ? "特売作業" : "価格変更"}</span><h3>{String(instruction.title)}</h3><p>{name(instruction.product_id, products)} · 指示価格 ¥{Number(instruction.price_yen).toLocaleString("ja-JP")} · {new Date(String(instruction.effective_at)).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}（日本時間）</p><p className="instruction-message">{String(instruction.message)}</p>
      {targets.filter((t) => t.instruction_id === instruction.id).map((target) => <div className="instruction-receipt" key={String(target.store_id)}><strong>{name(target.store_id, stores)}</strong><span>{target.confirmed_at ? "店舗確認済み" : "未確認"}</span>{!canManage && !target.confirmed_at && <InstructionConfirmation instructionId={instruction.id} storeId={String(target.store_id)} />}</div>)}
    </article>)}
  </section>;
}
