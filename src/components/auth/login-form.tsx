"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { signIn } from "@/server/actions/auth";
import Link from "next/link";

export function LoginForm({
  accessDenied = false,
  returnTo,
}: {
  accessDenied?: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    accessDenied
      ? "このアカウントは利用できません。管理者にお問い合わせください。"
      : "",
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    try {
      const data = new FormData();
      data.set("email", email);
      data.set("password", password);
      data.set("next", returnTo ?? "");
      const result = await signIn(data);
      if (result.error || !result.next) {
        setErrorMessage(result.error ?? "ログインできませんでした。");
        return;
      }

      router.replace(result.next);
      router.refresh();
    } catch {
      setErrorMessage(
        "ログインを確認できませんでした。時間をおいて再度お試しください。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
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
      {errorMessage && (
        <p className="login-error" role="alert">
          {errorMessage}
        </p>
      )}
      <Link href="/account/reset">パスワードを忘れた場合</Link>
      <button className="login-submit" type="submit" disabled={submitting}>
        {submitting ? "確認しています…" : "ログイン"}
        {!submitting && <ArrowRight size={16} aria-hidden="true" />}
      </button>
    </form>
  );
}
