import { LockKeyhole } from "@/components/ui/icons";
import { LoginForm } from "@/components/auth/login-form";
import { PageLayout } from "@/components/ui/page-layout";
import Link from "next/link";
import { backendConfigured } from "@/server/container";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <PageLayout page="login">
      <section className="page-panel auth-panel" aria-labelledby="login-heading">
        <span className="metric-icon green-icon">
          <LockKeyhole size={20} aria-hidden="true" />
        </span>
        <h2 id="login-heading">管理アカウントでログイン</h2>
        <p className="muted">
          上位権限の機能を利用する方は、個人の管理アカウントでログインしてください。
        </p>
        <LoginForm accessDenied={error === "access"} returnTo={next} />
        {!backendConfigured() && (
          <Link className="ghost-button" href="/admin">
            未接続の管理画面をプレビュー
          </Link>
        )}
        <p className="muted">このシステムは招待された方のみ利用できます。</p>
      </section>
    </PageLayout>
  );
}
