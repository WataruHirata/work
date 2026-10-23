import { notFound, redirect } from "next/navigation";
import { PageLayout } from "@/components/ui/page-layout";
import { FeatureNotice } from "@/components/ui/feature-notice";
import { uiConfig } from "@/config/ui";
import Link from "next/link";
import { backendConfigured, identity } from "@/server/container";
import { deviceSnapshot } from "@/server/auth/store-context";
import { DeviceWorkspace } from "@/components/store/device-workspace";
import { DataWorkspace, type WorkspaceSearch } from "@/components/workspaces/data-workspace";
import { CampaignWorkspace } from "@/components/campaigns/campaign-workspace";
import { PreviewWorkspace } from "@/components/preview/preview-workspace";
import {
  StoreInventoryWorkspace,
  StoreSalesWorkspace,
} from "@/components/store/store-sales-inventory-workspace";

export default async function StoreFeaturePage({
  params,
  searchParams,
}: {
  params: Promise<{ feature: string }>;
  searchParams: Promise<WorkspaceSearch>;
}) {
  const { feature } = await params;
  if (feature === "sales-inventory") redirect("/store/sales");
  const page = uiConfig.navigation.find((id) => uiConfig.pages[id].href === `/store/${feature}`);
  if (!page) notFound();
  if (page === "storeSales") return <StoreSalesWorkspace search={await searchParams} />;
  if (page === "storeInventory") return <StoreInventoryWorkspace search={await searchParams} />;
  if (!backendConfigured()) return <PreviewWorkspace feature={page} />;
  if (backendConfigured()) {
    const session = await identity().session();
    if (session?.active)
      return page === "storeCampaigns" ? (
        <CampaignWorkspace storeMode />
      ) : (
        <DataWorkspace feature={page} search={await searchParams} />
      );
    const result = await deviceSnapshot().then(
      (snapshot) => ({ snapshot, failed: false }),
      () => ({ snapshot: null, failed: true }),
    );
    if (result.failed) {
      return (
        <PageLayout page={page}>
          <FeatureNotice title="店舗端末の接続を確認してください">
            <Link href="/station" className="primary-button">
              端末を再接続
            </Link>
          </FeatureNotice>
        </PageLayout>
      );
    }
    if (result.snapshot) return <DeviceWorkspace feature={page} snapshot={result.snapshot} />;
  }
  return (
    <PageLayout page={page}>
      <FeatureNotice title="店舗端末を接続してください">
        <div className="button-row">
          <Link className="primary-button" href="/station">
            店舗端末の接続
          </Link>
        </div>
      </FeatureNotice>
    </PageLayout>
  );
}
