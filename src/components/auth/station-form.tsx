"use client";
import { useActionState } from "react";
import { connectStation } from "@/server/actions/station";
import { Feedback } from "@/components/workspaces/workspace-forms";
export function StationForm() {
  const [state, action, pending] = useActionState(connectStation, {});
  return (
    <form action={action} className="workspace-form">
      <label className="field">
        <span>店舗端末の接続コード</span>
        <input
          name="token"
          type="password"
          autoComplete="off"
          required
          minLength={64}
          maxLength={64}
        />
      </label>
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "確認中…" : "この端末を接続"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
