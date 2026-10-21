import { PageLayout } from "@/components/ui/page-layout";
import { StoreOverview } from "@/components/store/store-overview";
import Link from "next/link";
import { backendConfigured } from "@/server/container";
import { deviceSnapshot } from "@/server/auth/store-context";
import { LiveStoreOverview } from "@/components/store/live-store-overview";
import { FeatureNotice } from "@/components/ui/feature-notice";

export default async function Home() {
  if (!backendConfigured()) return <PageLayout page="dashboard"><StoreOverview /></PageLayout>;
  const result = await deviceSnapshot().then((snapshot) => ({ snapshot, failed: false }), () => ({ snapshot: null, failed: true }));
  if (result.failed) return <PageLayout page="dashboard"><FeatureNotice title="店舗データを取得できませんでした">接続または端末登録の状態を確認してください。<Link className="ghost-button" href="/station">接続を確認</Link></FeatureNotice></PageLayout>;
  if (result.snapshot) return <PageLayout page="dashboard"><LiveStoreOverview snapshot={result.snapshot} /></PageLayout>;
  return <PageLayout page="dashboard"><FeatureNotice title="店舗端末を接続すると、自店舗の概況を表示します"><Link className="primary-button" href="/station">店舗端末の接続</Link></FeatureNotice></PageLayout>;
}
