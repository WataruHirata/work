"use client";
import { useActionState } from "react";
import { executeOperation } from "@/server/actions/workspace";
import { Feedback } from "@/components/workspaces/workspace-forms";
function local(instant: string) {
  return new Date(Date.parse(instant) + 9 * 3600000).toISOString().slice(0, 16);
}
export function DraftEditor({
  campaign,
}: {
  campaign: {
    id: string;
    name: string;
    starts_at: string;
    ends_at: string;
    updated_at?: string;
    items: { id: string; priceYen: number; product: { name: string } | null }[];
  };
}) {
  const [state, action, pending] = useActionState(executeOperation.bind(null, "editCampaign"), {});
  return (
    <details>
      <summary>下書きの名前・期間・価格を編集</summary>
      <form action={action} className="workspace-form">
        <input type="hidden" name="campaignId" value={campaign.id} />
        <input type="hidden" name="version" value={campaign.updated_at} />
        <label className="field">
          <span>特売名</span>
          <input name="name" defaultValue={campaign.name} required maxLength={200} />
        </label>
        <div className="workspace-fields">
          <label className="field">
            <span>開始日時（日本時間）</span>
            <input
              type="datetime-local"
              name="startsAt"
              defaultValue={local(campaign.starts_at)}
              required
            />
          </label>
          <label className="field">
            <span>終了日時（日本時間）</span>
            <input
              type="datetime-local"
              name="endsAt"
              defaultValue={local(campaign.ends_at)}
              required
            />
          </label>
        </div>
        {campaign.items.map((item) => (
          <label className="field" key={item.id}>
            <span>{item.product?.name ?? "商品"}の特売価格（円）</span>
            <input
              type="number"
              name={`price:${item.id}`}
              min={0}
              max={2147483647}
              defaultValue={item.priceYen}
              required
            />
          </label>
        ))}
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "保存中…" : "下書きの変更を保存"}
        </button>
        <Feedback state={state} />
      </form>
    </details>
  );
}
