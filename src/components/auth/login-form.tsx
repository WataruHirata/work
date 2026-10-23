"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "@/components/ui/icons";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { selectAdminRole, signIn } from "@/server/actions/auth";
import { adminRoleLabels, type AdminRole } from "@/domain/access-policy";
import Link from "next/link";

export function LoginForm({
  accessDenied = false,
  returnTo,
  initialRoles = [],
}: {
  accessDenied?: boolean;
  returnTo?: string;
  initialRoles?: AdminRole[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<AdminRole[]>(initialRoles);
  const [selectedRole, setSelectedRole] = useState<AdminRole | "">(initialRoles[0] ?? "");
  const [errorMessage, setErrorMessage] = useState(
    accessDenied ? "このアカウントは利用できません。管理者にお問い合わせください。" : "",
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    try {
      if (availableRoles.length) {
        if (!selectedRole) {
          setErrorMessage("利用する権限を選択してください。");
          return;
        }
        const result = await selectAdminRole(selectedRole, returnTo);
        if (result.error || !result.next) {
          setErrorMessage(result.error ?? "選択した権限でログインできませんでした。");
          return;
        }
        router.replace(result.next);
        router.refresh();
        return;
      }

      const data = new FormData();
      data.set("email", email);
      data.set("password", password);
      data.set("next", returnTo ?? "");
      const result = await signIn(data);
      if (result.error || !result.next) {
        if (result.roles?.length) {
          setAvailableRoles(result.roles);
          setSelectedRole(result.roles[0]);
          return;
        }
        setErrorMessage(result.error ?? "ログインできませんでした。");
        return;
      }

      router.replace(result.next);
      router.refresh();
    } catch {
      setErrorMessage("ログインを確認できませんでした。時間をおいて再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {availableRoles.length === 0 && (
        <label className="login-field">
          <span>メールアドレス</span>
          <span className="login-input-wrap">
            <Mail size={16} aria-hidden="true" />
            <input
              autoComplete="username"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.co.jp"
            />
          </span>
        </label>
      )}
      {availableRoles.length === 0 && (
        <label className="login-field">
          <span>パスワード</span>
          <span className="login-input-wrap">
            <LockKeyhole size={16} aria-hidden="true" />
            <input
              autoComplete="current-password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="パスワードを入力"
            />
            <button
              className="password-toggle"
              type="button"
              aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>
      )}
      {errorMessage && (
        <p className="login-error" role="alert">
          {errorMessage}
        </p>
      )}
      {availableRoles.length === 0 && <Link href="/account/reset">パスワードを忘れた場合</Link>}
      {availableRoles.length > 0 && (
        <fieldset className="login-role-picker">
          <legend>利用する権限を選択</legend>
          <div className="login-role-tabs" role="group" aria-label="割当済み権限">
            {availableRoles.map((role) => (
              <button
                className={`login-role-tab${selectedRole === role ? " is-selected" : ""}`}
                key={role}
                type="button"
                aria-pressed={selectedRole === role}
                onClick={() => setSelectedRole(role)}
              >
                {adminRoleLabels[role]}
              </button>
            ))}
          </div>
          <p className="muted">このメールアドレスに割り当てられた権限のみ選択できます。</p>
        </fieldset>
      )}
      <button className="login-submit" type="submit" disabled={submitting}>
        {submitting ? "確認しています…" : availableRoles.length ? "選択した権限で続行" : "ログイン"}
        {!submitting && <ArrowRight size={16} aria-hidden="true" />}
      </button>
    </form>
  );
}
