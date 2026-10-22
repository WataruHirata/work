import { randomUUID } from "node:crypto";
import { allRecords } from "@/server/queries/workspaces";
import { InstructionForm, InstructionConfirmation } from "@/components/campaigns/instruction-form";
import { StateBadge } from "@/components/ui/state-badge";
import { CollapsibleList } from "@/components/ui/collapsible-list";

export async function InstructionWorkspace({
  canManage = false,
  storeId,
}: {
  canManage?: boolean;
  storeId?: string;
}) {
  const [instructions, targets, stores, products] = await Promise.all([
    allRecords("instructions"),
    allRecords("instructionTargets", storeId ? { storeId } : {}),
    allRecords("stores"),
    allRecords("products"),
  ]);
  const targetedInstructionIds = new Set(targets.map((target) => target.instruction_id));
  const visibleInstructions = storeId
    ? instructions.filter((instruction) => targetedInstructionIds.has(instruction.id))
    : instructions;
  const name = (id: unknown, rows: typeof stores) =>
    String(rows.find((row) => row.id === id)?.name ?? "参照権限のない項目");
  const instructionCards = visibleInstructions.map((instruction) => (
    <article className="instruction-card" key={instruction.id}>
      <StateBadge
        state="draft"
        label={instruction.kind === "promotion" ? "特売作業" : "価格変更"}
      />
      <h3>{String(instruction.title)}</h3>
      <p>
        {name(instruction.product_id, products)} · 指示価格 ¥
        {Number(instruction.price_yen).toLocaleString("ja-JP")} ·{" "}
        {new Date(String(instruction.effective_at)).toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
        })}
        （日本時間）
      </p>
      <p className="instruction-message">{String(instruction.message)}</p>
      {targets
        .filter((target) => target.instruction_id === instruction.id)
        .map((target) => (
          <div className="instruction-receipt" key={String(target.store_id)}>
            <strong>{name(target.store_id, stores)}</strong>
            <StateBadge
              state={target.confirmed_at ? "completed" : "not_configured"}
              label={target.confirmed_at ? "店舗確認済み" : "未確認"}
            />
            {!canManage && !target.confirmed_at && (
              <InstructionConfirmation
                instructionId={instruction.id}
                storeId={String(target.store_id)}
              />
            )}
          </div>
        ))}
    </article>
  ));
  return (
    <section className="instruction-workspace">
      <div className="panel-head">
        <h2>本部からの特売・価格変更指示</h2>
        <StateBadge state="draft" label={`全${visibleInstructions.length}件`} />
      </div>
      {canManage && (
        <details>
          <summary>変更指示を作成する</summary>
          <InstructionForm
            requestId={randomUUID()}
            stores={stores
              .filter((s) => s.status === "active")
              .map((s) => ({ id: s.id, name: String(s.name) }))}
            products={products
              .filter((p) => p.active)
              .map((p) => ({ id: p.id, name: String(p.name) }))}
          />
        </details>
      )}
      {!visibleInstructions.length && <p>現在、対象の変更指示はありません。</p>}
      <CollapsibleList className="notice-list">{instructionCards}</CollapsibleList>
    </section>
  );
}
