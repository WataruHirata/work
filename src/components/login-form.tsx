"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function isDemoLogin(email: string, password: string) {
  return email.trim() === "" && password.trim() === "";
}

export function LoginForm({ accessDenied = false }: { accessDenied?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    accessDenied ? "このアカウントは利用できません。管理者にお問い合わせください。" : "",
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    if (isDemoLogin(email, password)) {
      localStorage.setItem("demo-auth", "enabled");
      router.replace("/");
      setSubmitting(false);
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMessage("メールアドレスまたはパスワードを確認してください。");
        return;
      }

      router.replace("/");
    } catch (error) {
      console.error("Sign-in request failed.", error);
      setErrorMessage("ログインを確認できませんでした。時間をおいて再度お試しください。");
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
      {errorMessage && <p className="login-error" role="alert">{errorMessage}</p>}
      <button className="login-submit" type="submit" disabled={submitting}>
        {submitting ? "確認しています…" : "ログイン"}
        {!submitting && <ArrowRight size={16} aria-hidden="true" />}
      </button>
    </form>
  );
}
