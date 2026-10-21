"use client";
import { useActionState } from "react";
import { changePassword, resetPassword } from "@/server/actions/auth";
import { Feedback } from "@/components/workspaces/workspace-forms";
export function AccountForm({ reset = false }: { reset?: boolean }) {
  const [state, action, pending] = useActionState(reset ? resetPassword : changePassword, {});
  return <form action={action} className="workspace-form">{reset
    ? <label className="field"><span>登録メールアドレス</span><input name="email" type="email" required autoComplete="email" /></label>
    : <><label className="field"><span>新しいパスワード（12～128文字）</span><input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label><label className="field"><span>確認のためもう一度入力</span><input name="confirmation" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label></>}
    <button type="submit" className="primary-button" disabled={pending}>{pending ? "処理中…" : reset ? "再設定メールを送信" : "パスワードを変更"}</button><Feedback state={state} /></form>;
}
