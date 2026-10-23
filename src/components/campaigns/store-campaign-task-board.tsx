"use client";

import { useMemo, useState } from "react";
import { StateBadge } from "@/components/ui/state-badge";
import { InstructionConfirmation } from "@/components/campaigns/instruction-form";
import { ProgressAction } from "@/components/campaigns/campaign-management";
import type { DataRecord } from "@/domain/contracts";

const taskTypes = [
  { key: "instruction-promotion", label: "特売指示" },
  { key: "instruction-price", label: "価格変更指示" },
  { key: "pos_changed", label: "POS価格変更" },
  { key: "price_label_changed", label: "商品値札変更" },
  { key: "pop_changed", label: "POP変更" },
  { key: "display_changed", label: "売場表示変更" },
  { key: "price_label_restored", label: "値札の通常価格復帰" },
  { key: "pop_restored", label: "POP復帰" },
  { key: "display_restored", label: "売場表示復帰" },
] as const;

type BoardItem = {
  id: string;
  kind: (typeof taskTypes)[number]["key"];
  label: string;
  title: string;
  productCode: string;
  productName: string;
  description: string;
  when: string;
  completed: boolean;
  instructionId?: string;
  campaignItemId?: string;
  task?: string;
  disabled?: boolean;
};

const value = (row: DataRecord | undefined, key: string) => {
  const item = row?.[key];
  return typeof item === "string" || typeof item === "number" ? String(item) : "";
};

const taskLabel = (kind: BoardItem["kind"]) =>
  taskTypes.find((task) => task.key === kind)?.label ?? "作業指示";

function FilteredTaskColumn({
  title,
  items,
  storeId,
}: {
  title: string;
  items: BoardItem[];
  storeId: string;
}) {
  const [kind, setKind] = useState("");
  const [product, setProduct] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const filtered = useMemo(() => {
    const term = product.trim().toLocaleLowerCase("ja-JP");
    return items.filter((item) => {
      const date = item.when.slice(0, 10);
      return (
        (!kind || item.kind === kind) &&
        (!term ||
          `${item.productCode} ${item.productName}`.toLocaleLowerCase("ja-JP").includes(term)) &&
        (!from || date >= from) &&
        (!to || date <= to)
      );
    });
  }, [from, items, kind, product, to]);

  return (
    <section className="store-task-column" aria-label={title}>
      <header className="store-task-column-heading">
        <h3>{title}</h3>
        <StateBadge
          state={title === "対応済み" ? "completed" : "not_configured"}
          label={`${filtered.length}件`}
        />
      </header>
      <div className="store-task-filters" aria-label={`${title}の絞り込み`}>
        <label className="field">
          <span>タスクの種類</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="">すべて</option>
            {taskTypes.map((task) => (
              <option key={task.key} value={task.key}>
                {task.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>対応商品</span>
          <input
            type="search"
            value={product}
            onChange={(event) => setProduct(event.target.value)}
            placeholder="商品名・品目コード"
          />
        </label>
        <label className="field">
          <span>日時（開始）</span>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="field">
          <span>日時（終了）</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div>
      {filtered.length ? (
        <div className="store-task-list">
          {filtered.map((item) => (
            <article className="instruction-card store-task-card" key={item.id}>
              <div className="store-task-card-title">
                <StateBadge
                  state={item.completed ? "completed" : "not_configured"}
                  label={item.completed ? "対応済み" : "要対応"}
                />
                <span className="store-task-kind">{item.label}</span>
              </div>
              <h4>{item.title}</h4>
              {item.productName && (
                <p>
                  商品：{item.productCode} {item.productName}
                </p>
              )}
              {item.description && <p>{item.description}</p>}
              <p className="muted">
                日時：{new Date(item.when).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
              </p>
              {item.instructionId && !item.completed && (
                <InstructionConfirmation instructionId={item.instructionId} storeId={storeId} />
              )}
              {item.campaignItemId && item.task && !item.completed && (
                <ProgressAction
                  campaignItemId={item.campaignItemId}
                  storeId={storeId}
                  task={item.task}
                  completed={item.completed}
                  disabled={item.disabled}
                />
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">条件に合うタスクはありません。</p>
      )}
    </section>
  );
}

export function StoreCampaignTaskBoard({
  storeId,
  instructions,
  instructionTargets,
  products,
  campaigns,
  campaignItems,
  campaignTargets,
  tasks,
}: {
  storeId: string;
  instructions: DataRecord[];
  instructionTargets: DataRecord[];
  products: DataRecord[];
  campaigns: DataRecord[];
  campaignItems: DataRecord[];
  campaignTargets: DataRecord[];
  tasks: DataRecord[];
}) {
  const productById = new Map(products.map((product) => [product.id, product]));
  const visibleInstructions = instructions.filter((instruction) =>
    instructionTargets.some(
      (target) => target.instruction_id === instruction.id && target.store_id === storeId,
    ),
  );
  const items: BoardItem[] = visibleInstructions.flatMap((instruction) => {
    const product = productById.get(value(instruction, "product_id"));
    const target = instructionTargets.find(
      (row) => row.instruction_id === instruction.id && row.store_id === storeId,
    );
    const kind =
      value(instruction, "kind") === "promotion" ? "instruction-promotion" : "instruction-price";
    return [
      {
        id: `instruction:${instruction.id}`,
        kind,
        label: taskLabel(kind),
        title: value(instruction, "title"),
        productCode: value(product, "code"),
        productName: value(product, "name"),
        description: `${value(instruction, "message")} · 指示価格 ¥${Number(value(instruction, "price_yen") || 0).toLocaleString("ja-JP")}`,
        when: value(target, "confirmed_at") || value(instruction, "effective_at"),
        completed: Boolean(value(target, "confirmed_at")),
        instructionId: instruction.id,
      },
    ];
  });

  const taskDefinitions = [
    {
      task: "pos_changed",
      kind: "pos_changed",
      timestamp: "pos_promotion_status",
      completedAt: "pos_promotion_confirmed_at",
      done: (row: DataRecord) =>
        ["applied", "manual_confirmed"].includes(value(row, "pos_promotion_status")),
      disabled: (row: DataRecord) => value(row, "pos_promotion_status") === "applied",
      when: "starts_at",
    },
    {
      task: "price_label_changed",
      kind: "price_label_changed",
      timestamp: "price_label_changed_at",
      completedAt: "price_label_changed_at",
      when: "starts_at",
    },
    {
      task: "pop_changed",
      kind: "pop_changed",
      timestamp: "pop_changed_at",
      completedAt: "pop_changed_at",
      when: "starts_at",
    },
    {
      task: "display_changed",
      kind: "display_changed",
      timestamp: "display_changed_at",
      completedAt: "display_changed_at",
      when: "starts_at",
    },
    {
      task: "price_label_restored",
      kind: "price_label_restored",
      timestamp: "price_label_restored_at",
      completedAt: "price_label_restored_at",
      when: "ends_at",
    },
    {
      task: "pop_restored",
      kind: "pop_restored",
      timestamp: "pop_restored_at",
      completedAt: "pop_restored_at",
      when: "ends_at",
    },
    {
      task: "display_restored",
      kind: "display_restored",
      timestamp: "display_restored_at",
      completedAt: "display_restored_at",
      when: "ends_at",
    },
  ] as const;
  const targetedCampaignIds = new Set(
    campaignTargets
      .filter((target) => target.store_id === storeId)
      .map((target) => String(target.campaign_id)),
  );
  for (const campaign of campaigns) {
    if (!targetedCampaignIds.has(campaign.id) || value(campaign, "status") === "draft") continue;
    const itemsForCampaign = campaignItemsByCampaign(campaignItems, campaign.id);
    for (const campaignItem of itemsForCampaign) {
      const product = productById.get(value(campaignItem, "product_id"));
      const task = tasks.find(
        (candidate) =>
          candidate.campaign_item_id === campaignItem.id && candidate.store_id === storeId,
      );
      for (const definition of taskDefinitions) {
        const done =
          "done" in definition
            ? definition.done(task ?? { id: "" })
            : Boolean(value(task, definition.timestamp));
        const kind = definition.kind as BoardItem["kind"];
        items.push({
          id: `campaign:${campaign.id}:${campaignItem.id}:${definition.task}`,
          kind,
          label: taskLabel(kind),
          title: value(campaign, "name"),
          productCode: value(product, "code"),
          productName: value(product, "name"),
          description: `特売価格 ¥${Number(value(campaignItem, "price_yen") || 0).toLocaleString("ja-JP")}`,
          when:
            (done ? value(task, definition.completedAt) : "") || value(campaign, definition.when),
          completed: done,
          campaignItemId: campaignItem.id,
          task: definition.task,
          disabled: "disabled" in definition ? definition.disabled(task ?? { id: "" }) : false,
        });
      }
    }
  }

  const pending = items.filter((item) => !item.completed);
  const completed = items.filter((item) => item.completed);
  return (
    <section className="instruction-workspace store-campaign-board">
      <header className="panel-head">
        <div>
          <h2>本部からの特売・価格変更指示</h2>
        </div>
      </header>
      <div className="store-campaign-task-columns">
        <FilteredTaskColumn title="要対応" items={pending} storeId={storeId} />
        <FilteredTaskColumn title="対応済み" items={completed} storeId={storeId} />
      </div>
    </section>
  );
}

function campaignItemsByCampaign(items: DataRecord[], campaignId: string) {
  return items.filter((item) => item.campaign_id === campaignId);
}
