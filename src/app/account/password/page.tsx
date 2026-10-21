import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountForm } from "@/components/auth/account-form";
import { identity, backendConfigured } from "@/server/container";
export default async function PasswordPage() {
  if (!backendConfigured()) redirect("/login");
  const session = await identity().session();
  if (!session?.active) redirect("/login");
  return <main className="page-shell" id="main-content"><section className="page-panel"><h1>パスワード変更</h1><p>初回ログイン時は、業務操作の前にご自身のパスワードへ変更してください。</p><AccountForm /><div className="button-row"><Link className="ghost-button" href="/">店舗ポータル</Link><Link className="ghost-button" href="/admin">管理メニュー</Link></div></section></main>;
}
