import { PageLayout } from "@/components/ui/page-layout";
import { StoreOverview } from "@/components/store/store-overview";
import Link from "next/link";
import { backendConfigured } from "@/server/container";
import { deviceSnapshot } from "@/server/auth/store-context";
import { LiveStoreOverview } from "@/components/store/live-store-overview";
import { FeatureNotice } from "@/components/ui/feature-notice";
import { storeSummary } from "@/domain/store-summary";
import { StateBadge } from "@/components/ui/state-badge";
import { LayoutDashboard } from "lucide-react";

export default async function Home() {
  if (!backendConfigured())
    return (
      <PageLayout page="dashboard">
        <StoreOverview />
      </PageLayout>
    );
  const result = await deviceSnapshot().then(
    (snapshot) => ({ snapshot, failed: false }),
    () => ({ snapshot: null, failed: true }),
  );
  if (result.failed)
    return (
      <PageLayout page="dashboard">
        <FeatureNotice title="店舗データを取得できませんでした">
          接続または端末登録の状態を確認してください。
          <Link className="ghost-button" href="/station">
            接続を確認
          </Link>
        </FeatureNotice>
      </PageLayout>
    );
  if (result.snapshot) {
    const summary = storeSummary(result.snapshot);
    return (
      <PageLayout
        page="dashboard"
        headerContent={
          <div className="store-portal-header">
            <span className="page-heading-mark">
              <LayoutDashboard size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">STORE OVERVIEW</p>
              <h1>{summary.storeName}</h1>
            </div>
            <p className="store-portal-header-meta">
              直近営業日 {summary.latest?.date ?? "データなし"} · 税込売上
            </p>
            {summary.latest && summary.latest.status !== "imported" && (
              <StateBadge state={summary.latest.status} />
            )}
          </div>
        }
      >
        <LiveStoreOverview snapshot={result.snapshot} />
      </PageLayout>
    );
  }
  return (
    <PageLayout page="dashboard">
      <FeatureNotice title="店舗端末を接続すると、自店舗の概況を表示します">
        <Link className="primary-button" href="/station">
          店舗端末の接続
        </Link>
      </FeatureNotice>
    </PageLayout>
  );
}
