"use client";

import { useActionState } from "react";
import {
  sendInstruction,
  confirmInstruction,
} from "@/server/actions/instructions";
import type { ActionResult } from "@/domain/contracts";
type Option = { id: string; name: string };

export function InstructionForm({
  stores,
  products,
  requestId,
}: {
  stores: Option[];
  products: Option[];
  requestId: string;
}) {
  const [state, action, pending] = useActionState(
    sendInstruction,
    {} as ActionResult,
  );
  return (
    <form action={action} className="instruction-form">
      <input name="requestId" type="hidden" value={requestId} />
      <div className="workspace-fields">
        <label className="field">
          指示の種類
          <select name="kind" required>
            <option value="price_change">価格変更</option>
            <option value="promotion">特売の売場作業</option>
          </select>
        </label>
        <label className="field">
          件名
          <input name="title" maxLength={200} required />
        </label>
        <label className="field">
          対象商品
          <select name="productId" required>
            <option value="">選択してください</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          指示価格（円）
          <input
            name="priceYen"
            type="number"
            min="0"
            max="2147483647"
            step="1"
            required
          />
        </label>
        <label className="field">
          実施日時（日本時間）
          <input name="effectiveAt" type="datetime-local" required />
        </label>
      </div>
      <label className="field">
        変更内容・売場作業
        <textarea name="message" maxLength={2000} required rows={3} />
      </label>
      <fieldset className="instruction-targets">
        <legend>通知する店舗</legend>
        {stores.map((s) => (
          <label key={s.id}>
            <input name="storeIds" type="checkbox" value={s.id} />
            {s.name}
          </label>
        ))}
      </fieldset>
      <label className="instruction-confirm">
        <input name="confirmed" value="true" type="checkbox" required />
        商品・価格・実施日時・対象店舗を確認しました
      </label>
      <button
        className="primary-button"
        disabled={
          pending ||
          Boolean(state.success) ||
          !stores.length ||
          !products.length
        }
      >
        {pending ? "発行中…" : "指示を発行して店舗へ通知"}
      </button>
      {state.error && (
        <p role="alert" className="login-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status">
          {state.success} 続けて作成する場合は画面を再読み込みしてください。
        </p>
      )}
    </form>
  );
}

export function InstructionConfirmation({
  instructionId,
  storeId,
}: {
  instructionId: string;
  storeId: string;
}) {
  const [state, action, pending] = useActionState(
    confirmInstruction,
    {} as ActionResult,
  );
  return (
    <form action={action}>
      <input type="hidden" name="instructionId" value={instructionId} />
      <input type="hidden" name="storeId" value={storeId} />
      <button className="ghost-button" disabled={pending}>
        {pending ? "記録中…" : "指示内容を確認しました"}
      </button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </form>
  );
}
