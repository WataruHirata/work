import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdminFeature } from "@/server/auth/admin-access";
import { CampaignManagement, type CampaignTask } from "@/components/campaigns/campaign-management";
import { FeatureNotice } from "@/components/ui/feature-notice";
import { PageLayout } from "@/components/ui/page-layout";
import { backendConfigured, identity } from "@/server/container";
import { allRecords } from "@/server/queries/workspaces";
import type { DataRecord } from "@/domain/contracts";
import { PreviewWorkspace } from "@/components/preview/preview-workspace";
import { hasAdminAccess } from "@/domain/access-policy";
import { Tag } from "@/components/ui/icons";

const timestamp = (value: unknown) => (value instanceof Date ? value.toISOString() : String(value));

export async function CampaignWorkspace({
  storeId,
  storeMode = false,
}: {
  storeId?: string;
  storeMode?: boolean;
}) {
  if (!storeMode) await requireAdminFeature("campaigns");
  if (!backendConfigured())
    return <PreviewWorkspace feature={storeMode ? "storeCampaigns" : "campaigns"} />;
  const session = await identity().session();
  if (!session?.active)
    redirect(`/login?next=${storeMode ? "/store/campaigns" : "/admin/campaigns"}`);
  if (session.mustChangePassword) redirect("/account/password");
  let records: DataRecord[][];
  try {
    records = await Promise.all([
      allRecords("stores"),
      allRecords("products"),
      allRecords("campaigns"),
      allRecords("campaignItems"),
      allRecords("campaignTargets"),
      allRecords("campaignTasks"),
    ]);
  } catch {
    const href = storeMode ? "/store/campaigns" : "/admin/campaigns";
    return (
      <PageLayout page={storeMode ? "storeCampaigns" : "campaigns"}>
        <FeatureNotice title="特売情報を読み込めませんでした">
          データベース接続と特売用マイグレーションを確認し、
          <Link className="ghost-button" href={href}>
            再読み込み
          </Link>
        </FeatureNotice>
      </PageLayout>
    );
  }
  const [allStores, products, campaigns, items, targets, tasks] = records;
  const stores =
    storeMode && !hasAdminAccess(session.roles)
      ? allStores.filter((store) => (session.storeIds ?? []).includes(store.id))
      : allStores;
  if (storeMode && !stores.length) notFound();
  if (storeId && !stores.some((store) => store.id === storeId)) notFound();
  const selectedStoreId = storeId ?? stores[0]?.id ?? "";
  const visibleCampaigns = storeMode
    ? campaigns.filter((campaign) =>
        targets.some(
          (target) => target.campaign_id === campaign.id && target.store_id === selectedStoreId,
        ),
      )
    : campaigns;
  const option = (row: DataRecord) => ({
    id: row.id,
    code: String(row.code),
    name: String(row.name),
    status: typeof row.status === "string" ? row.status : undefined,
  });
  return (
    <PageLayout
      page={storeMode ? "storeCampaigns" : "campaigns"}
      headerMark={<Tag size={20} aria-hidden="true" />}
      eyebrow="PROMOTION OPERATIONS"
    >
      <CampaignManagement
        canRecordStoreWork={session.roles.some((role) =>
          ["store_manager", "department_lead", "staff"].includes(role),
        )}
        isConfigured
        canManage={!storeMode && session.roles.includes("product_office")}
        stores={stores.map(option)}
        products={products.filter((product) => product.active).map(option)}
        selectedStoreId={selectedStoreId}
        basePath={storeMode ? "/store/campaigns" : "/admin/campaigns"}
        campaigns={visibleCampaigns.map((campaign) => ({
          id: campaign.id,
          storeIds: targets
            .filter((target) => target.campaign_id === campaign.id)
            .map((target) => String(target.store_id)),
          updated_at: timestamp(campaign.updated_at),
          name: String(campaign.name),
          starts_at: timestamp(campaign.starts_at),
          ends_at: timestamp(campaign.ends_at),
          status: String(campaign.status),
          published_at: campaign.published_at as string | null,
          created_at: String(campaign.created_at),
          storeConfirmedAt:
            (targets.find(
              (target) => target.campaign_id === campaign.id && target.store_id === selectedStoreId,
            )?.store_confirmed_at as string | null) ?? null,
          items: items
            .filter((item) => item.campaign_id === campaign.id)
            .map((item) => ({
              id: item.id,
              priceYen: Number(item.price_yen),
              eligibilityStatus: String(item.eligibility_status),
              product: products.find((product) => product.id === item.product_id)
                ? option(products.find((product) => product.id === item.product_id)!)
                : null,
              task:
                (tasks.find(
                  (task) => task.campaign_item_id === item.id && task.store_id === selectedStoreId,
                ) as unknown as CampaignTask | null) ?? null,
            })),
        }))}
      />
    </PageLayout>
  );
}
