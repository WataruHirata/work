import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-heading">
        <Link className="brand login-brand" href="/" aria-label="みのり屋">
          <span className="brand-mark"><span className="login-mark">み</span></span>
          <span className="brand-copy"><strong>みのり屋</strong><small>SALES OFFICE</small></span>
        </Link>
        <div className="login-eyebrow">STORE OPERATIONS</div>
        <h1 id="login-heading">おかえりなさい</h1>
        <p className="login-description">アカウント情報を入力してログインしてください。</p>
        <LoginForm accessDenied={error === "access"} />
        <p className="login-invite-note">このシステムは招待された方のみ利用できます。</p>
      </section>
      <footer className="login-footer">みのり屋 販売管理システム <span>·</span> 安全な業務アクセス</footer>
    </main>
  );
}
