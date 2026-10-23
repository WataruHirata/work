"use client";
import { useActionState } from "react";
import { connectStation } from "@/server/actions/station";
import { Feedback } from "@/components/workspaces/workspace-forms";
export function StationForm({ autoConnect = false }: { autoConnect?: boolean }) {
  const [state, action, pending] = useActionState(connectStation, {});
  return (
    <form action={action} className="workspace-form">
      {!autoConnect ? (
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
      ) : null}
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "接続中…" : autoConnect ? "デバイス1で開始" : "この端末を接続"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
