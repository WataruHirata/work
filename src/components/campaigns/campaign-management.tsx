"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { OperationForm } from "@/components/workspaces/workspace-forms";
import { DraftEditor } from "./draft-editor";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Plus,
  Tag,
  Store,
} from "lucide-react";
import {
  createCampaignDraftAction,
  publishCampaignDraftAction,
  updateCampaignProgressAction,
  type CampaignActionState,
} from "@/server/actions/campaigns";

type StoreOption = { id: string; code: string; name: string };
type ProductOption = { id: string; code: string; name: string };
export type CampaignTask = {
  pos_promotion_status: string;
  pos_promotion_confirmed_at: string | null;
  price_label_changed_at: string | null;
  pop_changed_at: string | null;
  display_changed_at: string | null;
  pos_restore_status: string;
  pos_restored_at: string | null;
  price_label_restored_at: string | null;
  pop_restored_at: string | null;
  display_restored_at: string | null;
};
type CampaignView = {
  updated_at?: string;
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  published_at: string | null;
  created_at: string;
  storeConfirmedAt: string | null;
  items: {
    id: string;
    priceYen: number;
    eligibilityStatus: string;
    product: ProductOption | null;
    task: CampaignTask | null;
  }[];
};
type Props = {
  instructionPanel?: ReactNode;
  basePath?: string;
  isConfigured: boolean;
  canManage: boolean;
  stores: StoreOption[];
  products: ProductOption[];
  campaigns: CampaignView[];
  selectedStoreId: string;
};
type DraftItem = { productId: string; priceYen: string };

const initialActionState: CampaignActionState = {};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function campaignStatus(status: string) {
  switch (status) {
    case "draft":
      return "下書き";
    case "scheduled":
      return "公開済・準備中";
    case "active":
      return "実施中";
    case "completed":
      return "完了";
    case "failed":
      return "要確認";
    default:
      return "状態不明";
  }
}

function ProgressAction({
  campaignItemId,
  storeId,
  task,
  completed,
  disabled = false,
}: {
  campaignItemId: string;
  storeId: string;
  task: string;
  completed: boolean;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(updateCampaignProgressAction, initialActionState);
  return (
    <form action={action} className="campaign-task-action">
      <input type="hidden" name="campaignItemId" value={campaignItemId} />
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="task" value={task} />
      <button
        type="submit"
        name="completed"
        value={completed ? "false" : "true"}
        className={completed ? "campaign-task-button is-complete" : "campaign-task-button"}
        disabled={disabled || pending}
      >
        {completed ? <Check size={13} aria-hidden="true" /> : null}
        {pending ? "保存中…" : completed ? "完了・取消" : "完了登録"}
      </button>
      {state.error ? (
        <span className="campaign-inline-error" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function PublishAction({ campaignId }: { campaignId: string }) {
  const [state, action, pending] = useActionState(publishCampaignDraftAction, initialActionState);
  return (
    <form action={action} className="campaign-publish-form">
      <input type="hidden" name="campaignId" value={campaignId} />
      <button className="campaign-publish-button" type="submit" disabled={pending}>
        {pending ? "公開しています…" : "対象店舗へ公開"}
        {!pending ? <ArrowRight size={14} aria-hidden="true" /> : null}
      </button>
      {state.error ? (
        <span className="campaign-inline-error" role="alert">
          {state.error}
        </span>
      ) : null}
      {state.success ? (
        <span className="campaign-inline-success" role="status">
          {state.success}
        </span>
      ) : null}
    </form>
  );
}

function CampaignDraftForm({
  stores,
  products,
}: {
  stores: StoreOption[];
  products: ProductOption[];
}) {
  const [state, action, pending] = useActionState(createCampaignDraftAction, initialActionState);
  const [items, setItems] = useState<DraftItem[]>([
    { productId: products[0]?.id ?? "", priceYen: "" },
  ]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const selectedProductIds = items.map((item) => item.productId).filter(Boolean);
  const hasDuplicateProducts = new Set(selectedProductIds).size !== selectedProductIds.length;

  function updateItem(index: number, field: keyof DraftItem, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    );
  }

  function toggleStore(storeId: string) {
    setSelectedStores((current) =>
      current.includes(storeId)
        ? current.filter((selected) => selected !== storeId)
        : [...current, storeId],
    );
  }

  function toggleAllStores() {
    setSelectedStores((current) =>
      current.length === stores.length ? [] : stores.map((store) => store.id),
    );
  }

  const canSubmit =
    stores.length > 0 && products.length > 0 && selectedStores.length > 0 && !hasDuplicateProducts;
  return (
    <details className="campaign-create-panel">
      <summary>
        <span>
          <Plus size={16} /> 特売を作成
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <form action={action} className="campaign-create-form">
        <label className="campaign-field">
          <span>特売名</span>
          <input name="name" placeholder="例：秋の青果フェア" required />
        </label>

        <div className="campaign-datetime-grid">
          <label className="campaign-field">
            <span>
              開始日時 <small>日本時間</small>
            </span>
            <input name="startsAt" type="datetime-local" required />
          </label>
          <label className="campaign-field">
            <span>
              終了日時 <small>日本時間</small>
            </span>
            <input name="endsAt" type="datetime-local" required />
          </label>
        </div>

        <section className="campaign-form-section" aria-labelledby="campaign-products-heading">
          <div className="campaign-form-section-heading">
            <div>
              <strong id="campaign-products-heading">対象商品・特売価格</strong>
              <small>通常売価の比較は参照元確認後に追加します。</small>
            </div>
            <button
              type="button"
              className="campaign-add-row"
              onClick={() => setItems((current) => [...current, { productId: "", priceYen: "" }])}
              disabled={products.length === 0}
            >
              <Plus size={14} /> 商品を追加
            </button>
          </div>
          <input
            type="hidden"
            name="items"
            value={JSON.stringify(
              items.map((item) => ({
                productId: item.productId,
                priceYen: item.priceYen === "" ? null : Number(item.priceYen),
              })),
            )}
          />
          {items.map((item, index) => (
            <div className="campaign-item-editor" key={`item-${index}`}>
              <label className="campaign-field">
                <span>商品 {index + 1}</span>
                <select
                  value={item.productId}
                  onChange={(event) => updateItem(index, "productId", event.target.value)}
                  required
                >
                  <option value="">商品を選択</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.code} · {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="campaign-field">
                <span>特売価格（円）</span>
                <input
                  type="number"
                  min="0"
                  max="2147483647"
                  step="1"
                  value={item.priceYen}
                  onChange={(event) => updateItem(index, "priceYen", event.target.value)}
                  required
                />
              </label>
              {items.length > 1 ? (
                <button
                  type="button"
                  className="campaign-remove-row"
                  onClick={() =>
                    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                  aria-label={`商品 ${index + 1} を削除`}
                >
                  削除
                </button>
              ) : null}
            </div>
          ))}
          {hasDuplicateProducts ? (
            <p className="campaign-empty-note" role="alert">
              同じ商品は一つの特売に重複登録できません。
            </p>
          ) : null}
          {products.length === 0 ? (
            <p className="campaign-empty-note">登録済みの有効商品がありません。</p>
          ) : null}
        </section>

        <section className="campaign-form-section" aria-labelledby="campaign-stores-heading">
          <div className="campaign-form-section-heading">
            <div>
              <strong id="campaign-stores-heading">対象店舗</strong>
              <small>{selectedStores.length}店舗を選択中</small>
            </div>
            <button
              type="button"
              className="campaign-add-row"
              onClick={toggleAllStores}
              disabled={stores.length === 0}
            >
              {selectedStores.length === stores.length ? "全店舗を解除" : "全店舗を選択"}
            </button>
          </div>
          <div className="campaign-store-picker">
            {stores.map((store) => (
              <label className="campaign-store-option" key={store.id}>
                <input
                  type="checkbox"
                  name="storeIds"
                  value={store.id}
                  checked={selectedStores.includes(store.id)}
                  onChange={() => toggleStore(store.id)}
                />
                <span>
                  {store.name}
                  <small>{store.code}</small>
                </span>
              </label>
            ))}
          </div>
          {stores.length === 0 ? (
            <p className="campaign-empty-note">対象にできる店舗がありません。</p>
          ) : null}
        </section>

        {state.error ? (
          <p className="campaign-form-message error-message" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="campaign-form-message success-message" role="status">
            {state.success}
          </p>
        ) : null}
        <div className="campaign-create-footer">
          <span>下書き保存後、内容を確認してから店舗へ公開します。</span>
          <button type="submit" className="campaign-save-button" disabled={!canSubmit || pending}>
            {pending ? "保存中…" : "下書き保存"}
          </button>
        </div>
      </form>
    </details>
  );
}

function taskState(value: string) {
  if (value === "applied" || value === "restored" || value === "manual_confirmed")
    return "POS反映確認済み";
  if (value === "failed") return "POS連携エラー";
  if (value === "pending") return "POS連携待ち";
  return "POS連携未設定";
}

function eligibilityLabel(value: string) {
  if (value === "eligible") return "特売対象確認済み";
  if (value === "excluded") return "EDLP等の対象外";
  return "対象区分未確認";
}

export function CampaignManagement({
  instructionPanel,
  isConfigured,
  canManage,
  stores,
  products,
  campaigns,
  selectedStoreId,
  basePath = "/admin/campaigns",
}: Props) {
  const selectedStore = stores.find((store) => store.id === selectedStoreId);
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const visibleCampaigns = showAllCampaigns ? campaigns : campaigns.slice(0, 8);

  return (
    <main className="campaign-page" id="main-content" tabIndex={-1}>
      <header className="campaign-topbar">
        <Link
          className="campaign-back-link"
          href={basePath.startsWith("/store") ? "/store" : "/admin"}
        >
          <ArrowLeft size={16} /> メニューへ戻る
        </Link>
        <div className={isConfigured ? "campaign-env-pill live" : "campaign-env-pill"}>
          <span />
          {isConfigured ? "Supabase接続" : "プレビュー"}
        </div>
      </header>
      <div className="campaign-content">
        {!isConfigured ? (
          <div className="campaign-notice preview-notice" role="status">
            <CircleAlert size={17} />
            <span>
              データベース未接続のため、特売の登録・状態更新は無効です。架空の商品や店舗を実データとして扱わないよう、この画面では永続化操作を提供していません。
            </span>
          </div>
        ) : null}
        <div className="campaign-heading">
          <div className="campaign-heading-icon">
            <Tag size={21} />
          </div>
          <div>
            <div className="campaign-eyebrow">PROMOTION OPERATIONS</div>
            <h1>特売管理</h1>
            <p>POS価格反映と店舗の売場作業を分けて確認します。</p>
          </div>
        </div>

        {isConfigured && !selectedStore ? (
          <div className="campaign-notice" role="status">
            <CircleAlert size={17} />
            <span>参照できる店舗がありません。情報システム部へ権限の割当を依頼してください。</span>
          </div>
        ) : null}

        {isConfigured && selectedStore ? (
          <form className="campaign-store-filter" action={basePath} method="get">
            <label htmlFor="campaign-store-select">
              <Store size={16} /> 作業対象店舗
            </label>
            <select id="campaign-store-select" name="store" defaultValue={selectedStoreId}>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.code} · {store.name}
                </option>
              ))}
            </select>
            <button type="submit">表示</button>
          </form>
        ) : null}

        {instructionPanel}
        {isConfigured && canManage ? (
          <CampaignDraftForm stores={stores} products={products} />
        ) : null}
        {isConfigured && !canManage ? (
          <div className="campaign-note">
            <CircleAlert size={15} />
            <span>
              本部特売の登録・公開は商品本部の権限が必要です。店舗の確認と売場作業は、対象店舗を選択して記録できます。
            </span>
          </div>
        ) : null}

        {isConfigured ? (
          <section className="campaign-list-section" aria-labelledby="campaign-list-heading">
            <div className="campaign-list-heading">
              <div>
                <div className="campaign-eyebrow">CAMPAIGN TRACKING</div>
                <h2 id="campaign-list-heading">特売と店舗対応状況</h2>
                <p>
                  {selectedStore
                    ? `${selectedStore.code} · ${selectedStore.name}`
                    : "対象店舗を選択してください"}{" "}
                  · 直近20件
                </p>
              </div>
              <span className="campaign-count">{campaigns.length}件</span>
            </div>

            {campaigns.length === 0 ? (
              <div className="campaign-empty-state">
                <Tag size={21} />
                <strong>表示できる特売はありません</strong>
                <span>
                  {canManage
                    ? "下書きを作成すると、ここで状態を確認できます。"
                    : "公開された特売があると、ここに店舗作業が表示されます。"}
                </span>
              </div>
            ) : (
              <div className="campaign-card-list">
                {visibleCampaigns.map((campaign) => {
                  const items = campaign.items;
                  const campaignEligible =
                    items.length > 0 &&
                    items.every((item) => item.eligibilityStatus === "eligible");
                  const publishAllowed = campaign.status === "draft" && campaignEligible;
                  const canTrack = campaign.status !== "draft" && campaignEligible;
                  const allStoreWorkComplete =
                    items.length > 0 &&
                    items.every(
                      (item) =>
                        item.task?.price_label_changed_at &&
                        item.task?.pop_changed_at &&
                        item.task?.display_changed_at,
                    );
                  return (
                    <article className="campaign-card" key={campaign.id}>
                      <div className="campaign-card-header">
                        <div>
                          <span className={`campaign-status status-${campaign.status}`}>
                            {campaignStatus(campaign.status)}
                          </span>
                          <h3>{campaign.name}</h3>
                          <p>
                            {formatDate(campaign.starts_at)} — {formatDate(campaign.ends_at)}
                          </p>
                        </div>
                        {canManage && campaign.status === "draft" && publishAllowed ? (
                          <PublishAction campaignId={campaign.id} />
                        ) : null}
                      </div>
                      {canManage && campaign.status === "draft" && campaign.updated_at ? (
                        <DraftEditor key={campaign.updated_at} campaign={campaign} />
                      ) : null}
                      {canManage && !campaignEligible ? (
                        <div className="campaign-publish-blocked" role="status">
                          <CircleAlert size={14} />
                          EDLP対象外の確認データが未接続、または商品が対象外のため、店舗への公開・作業記録は停止しています。
                        </div>
                      ) : null}

                      <button
                        className="campaign-expand-button"
                        type="button"
                        aria-expanded={expandedCampaignId === campaign.id}
                        onClick={() =>
                          setExpandedCampaignId(
                            expandedCampaignId === campaign.id ? null : campaign.id,
                          )
                        }
                      >
                        {items.length}商品 <span>·</span>
                        {expandedCampaignId === campaign.id ? "詳細を閉じる" : "店舗別の状態を確認"}
                      </button>
                      {expandedCampaignId === campaign.id ? (
                        <>
                          {canTrack && items[0] ? (
                            <div className="campaign-confirm-row">
                              <div>
                                <strong>店舗確認</strong>
                                <span>{campaign.storeConfirmedAt ? "確認済み" : "未確認"}</span>
                              </div>
                              <ProgressAction
                                campaignItemId={items[0].id}
                                storeId={selectedStoreId}
                                task="confirmed"
                                completed={Boolean(campaign.storeConfirmedAt)}
                              />
                            </div>
                          ) : null}

                          <div className="campaign-items">
                            {items.map((item) => {
                              const task = item.task;
                              return (
                                <div className="campaign-product-row" key={item.id}>
                                  <div className="campaign-product-heading">
                                    <span className="campaign-product-icon">
                                      <Tag size={15} />
                                    </span>
                                    <span>
                                      <strong>
                                        {item.product?.name ?? "商品情報を取得できません"}
                                      </strong>
                                      <small>
                                        {item.product?.code ?? ""} · 特売価格 ¥
                                        {formatYen(item.priceYen)} ·{" "}
                                        {eligibilityLabel(item.eligibilityStatus)}
                                      </small>
                                      {canManage && campaign.status === "draft" && (
                                        <OperationForm
                                          operation="verifyProduct"
                                          label="既存マスタの対象区分を反映"
                                        >
                                          <input type="hidden" name="itemId" value={item.id} />
                                        </OperationForm>
                                      )}
                                    </span>
                                    {task ? (
                                      <span className="campaign-pos-state">
                                        {taskState(task.pos_promotion_status)}
                                      </span>
                                    ) : null}
                                  </div>
                                  {canTrack ? (
                                    <div className="campaign-task-grid">
                                      <div className="campaign-task-group">
                                        <strong>開始時の売場作業</strong>
                                        <div>
                                          <span>値札</span>
                                          <ProgressAction
                                            campaignItemId={item.id}
                                            storeId={selectedStoreId}
                                            task="price_label_changed"
                                            completed={Boolean(task?.price_label_changed_at)}
                                          />
                                          <span>POP</span>
                                          <ProgressAction
                                            campaignItemId={item.id}
                                            storeId={selectedStoreId}
                                            task="pop_changed"
                                            completed={Boolean(task?.pop_changed_at)}
                                          />
                                          <span>売場表示</span>
                                          <ProgressAction
                                            campaignItemId={item.id}
                                            storeId={selectedStoreId}
                                            task="display_changed"
                                            completed={Boolean(task?.display_changed_at)}
                                          />
                                        </div>
                                      </div>
                                      <div className="campaign-task-group">
                                        <strong>終了時の通常状態への復帰</strong>
                                        <div>
                                          <span>値札</span>
                                          <ProgressAction
                                            campaignItemId={item.id}
                                            storeId={selectedStoreId}
                                            task="price_label_restored"
                                            completed={Boolean(task?.price_label_restored_at)}
                                          />
                                          <span>POP</span>
                                          <ProgressAction
                                            campaignItemId={item.id}
                                            storeId={selectedStoreId}
                                            task="pop_restored"
                                            completed={Boolean(task?.pop_restored_at)}
                                          />
                                          <span>売場表示</span>
                                          <ProgressAction
                                            campaignItemId={item.id}
                                            storeId={selectedStoreId}
                                            task="display_restored"
                                            completed={Boolean(task?.display_restored_at)}
                                          />
                                        </div>
                                        <small className="campaign-task-hint">
                                          復帰の記録は特売終了後に有効になります。
                                        </small>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                          {canTrack ? (
                            <div
                              className={
                                allStoreWorkComplete
                                  ? "campaign-work-summary complete"
                                  : "campaign-work-summary"
                              }
                            >
                              <span>
                                {allStoreWorkComplete ? (
                                  <Check size={14} />
                                ) : (
                                  <CircleAlert size={14} />
                                )}
                              </span>
                              <strong>
                                {allStoreWorkComplete
                                  ? "開始時の売場作業は完了"
                                  : "開始時の売場作業を確認してください"}
                              </strong>
                              <span>
                                POS価格連携:{" "}
                                {
                                  items.filter(
                                    (item) =>
                                      item.task?.pos_promotion_status === "applied" ||
                                      item.task?.pos_promotion_status === "manual_confirmed",
                                  ).length
                                }
                                /{items.length}商品
                              </span>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
            {campaigns.length > 8 ? (
              <button
                className="campaign-show-more"
                type="button"
                onClick={() => setShowAllCampaigns(!showAllCampaigns)}
              >
                {showAllCampaigns ? "表示を少なくする" : "残りの特売を表示"}
              </button>
            ) : null}
          </section>
        ) : null}

        <div className="campaign-note">
          <CircleAlert size={15} />
          <span>
            通常売価の参照元とPOS連携仕様は未確定です。価格の自動配信・通常売価への自動復帰は行いません。POS結果は「未設定」と表示し、値札・POP・売場表示の作業状態のみ記録します。
          </span>
        </div>
        <footer className="campaign-footer">
          みのり屋 販売管理システム <span>·</span> 特売業務
        </footer>
      </div>
    </main>
  );
}
