import { randomUUID } from "node:crypto";
import { allRecords } from "@/server/queries/workspaces";
import { InstructionForm, InstructionConfirmation } from "@/components/campaigns/instruction-form";
import { StateBadge } from "@/components/ui/state-badge";
import { ProgressAction } from "@/components/campaigns/campaign-management";

const formatDate = (value: unknown) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(String(value)));

export async function InstructionWorkspace({
  canManage = false,
  storeId,
  canRecordStoreWork = false,
}: {
  canManage?: boolean;
  storeId?: string;
  canRecordStoreWork?: boolean;
}) {
  const [
    instructions,
    targets,
    stores,
    products,
    campaigns,
    campaignItems,
    campaignTargets,
    tasks,
  ] = await Promise.all([
    allRecords("instructions"),
    allRecords("instructionTargets", storeId ? { storeId } : {}),
    allRecords("stores"),
    allRecords("products"),
    storeId ? allRecords("campaigns") : [],
    storeId ? allRecords("campaignItems") : [],
    storeId ? allRecords("campaignTargets", { storeId }) : [],
    storeId ? allRecords("campaignTasks", { storeId }) : [],
  ]);
  const targetedInstructionIds = new Set(targets.map((target) => target.instruction_id));
  const visibleInstructions = storeId
    ? instructions.filter((instruction) => targetedInstructionIds.has(instruction.id))
    : instructions;
  const selectedStore = storeId ? stores.find((store) => store.id === storeId) : undefined;
  const name = (id: unknown, rows: typeof stores) =>
    String(rows.find((row) => row.id === id)?.name ?? "参照権限のない項目");
  const targetedCampaignIds = new Set(
    campaignTargets
      .filter((target) => target.store_id === storeId)
      .map((target) => String(target.campaign_id)),
  );
  const campaignTaskCards = campaigns
    .filter(
      (campaign) =>
        targetedCampaignIds.has(campaign.id) &&
        ["scheduled", "active"].includes(String(campaign.status)),
    )
    .flatMap((campaign) =>
      campaignItems
        .filter((item) => item.campaign_id === campaign.id)
        .map((item) => {
          const product = products.find((row) => row.id === item.product_id);
          const task = tasks.find(
            (row) => row.campaign_item_id === item.id && row.store_id === storeId,
          );
          const posCompleted = ["applied", "manual_confirmed"].includes(
            String(task?.pos_promotion_status ?? ""),
          );
          const labelCompleted = Boolean(task?.price_label_changed_at);
          return (
            <article
              className="instruction-card campaign-notice-task"
              key={`${campaign.id}:${item.id}`}
            >
              <StateBadge
                state={posCompleted && labelCompleted ? "completed" : "not_configured"}
                label={posCompleted && labelCompleted ? "対応完了" : "対応が必要"}
              />
              <h3>POS・商品値札の変更依頼</h3>
              <p>
                <strong>{String(campaign.name)}</strong>
                <br />
                商品：{String(product?.code ?? "")} / {String(product?.name ?? "商品情報なし")}
                <br />
                特売価格：¥{Number(item.price_yen).toLocaleString("ja-JP")}
                <br />
                期間：{formatDate(campaign.starts_at)} ～ {formatDate(campaign.ends_at)}（日本時間）
              </p>
              <div className="campaign-notice-checklist" aria-label="店舗作業の完了状況">
                <div>
                  <span>
                    <strong>POSの価格変更</strong>
                    <small>{posCompleted ? "処理済み" : "未処理"}</small>
                  </span>
                  <ProgressAction
                    campaignItemId={item.id}
                    storeId={String(storeId)}
                    task="pos_changed"
                    completed={posCompleted}
                    disabled={!canRecordStoreWork || task?.pos_promotion_status === "applied"}
                  />
                </div>
                <div>
                  <span>
                    <strong>商品値札の変更</strong>
                    <small>{labelCompleted ? "処理済み" : "未処理"}</small>
                  </span>
                  <ProgressAction
                    campaignItemId={item.id}
                    storeId={String(storeId)}
                    task="price_label_changed"
                    completed={labelCompleted}
                    disabled={!canRecordStoreWork}
                  />
                </div>
              </div>
              {!canRecordStoreWork ? (
                <p className="muted">完了登録には、この店舗を担当する個人アカウントが必要です。</p>
              ) : null}
            </article>
          );
        }),
    );
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
      <p className="muted">
        指示の通知と店舗確認を管理します。指示価格はPOS・通常売価マスタへの反映結果とは別に表示します。
      </p>
      {selectedStore && <p className="muted">対象店舗: {String(selectedStore.name)}</p>}
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
      {storeId ? (
        <section className="campaign-notice-tasks" aria-labelledby="campaign-notice-tasks-heading">
          <div className="panel-head">
            <h3 id="campaign-notice-tasks-heading">店舗で行うPOS・商品値札タスク</h3>
            <StateBadge state="draft" label={`全${campaignTaskCards.length}件`} />
          </div>
          <p className="muted">各作業が終わったら、担当者がそれぞれ完了登録してください。</p>
          {campaignTaskCards.length ? (
            <div className="notice-list">{campaignTaskCards}</div>
          ) : (
            <p>現在、対応が必要な特売タスクはありません。</p>
          )}
        </section>
      ) : null}
      <h3>本部から届いたお知らせ</h3>
      {!visibleInstructions.length && <p>現在、対象の変更指示はありません。</p>}
      <div className="notice-list">{instructionCards.slice(0, 3)}</div>
      {instructionCards.length > 3 && (
        <details className="notice-expander">
          <summary>全{instructionCards.length}件を表示</summary>
          <div className="notice-list">{instructionCards.slice(3)}</div>
        </details>
      )}
    </section>
  );
}
