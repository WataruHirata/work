import { notFound, redirect } from "next/navigation";
import { CampaignManagement, type CampaignTask } from "@/components/campaigns/campaign-management";
import { backendConfigured, identity } from "@/server/container";
import { allRecords } from "@/server/queries/workspaces";
import type { DataRecord } from "@/domain/contracts";
import { PreviewWorkspace } from "@/components/preview/preview-workspace";
import { InstructionWorkspace } from "@/components/campaigns/instruction-workspace";
import { hasAdminAccess } from "@/domain/access-policy";

export async function CampaignWorkspace({
  storeId,
  storeMode = false,
}: {
  storeId?: string;
  storeMode?: boolean;
}) {
  if (!backendConfigured())
    return <PreviewWorkspace feature={storeMode ? "storeCampaigns" : "campaigns"} />;
  const session = await identity().session();
  if (!session?.active) redirect("/login?next=/store/campaigns");
  if (session.mustChangePassword) redirect("/account/password");
  const [allStores, products, campaigns, items, targets, tasks] = await Promise.all([
    allRecords("stores"),
    allRecords("products"),
    allRecords("campaigns"),
    allRecords("campaignItems"),
    allRecords("campaignTargets"),
    allRecords("campaignTasks"),
  ]);
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
  });
  return (
    <CampaignManagement
      instructionPanel={
        <InstructionWorkspace
          canManage={!storeMode && session.roles.includes("product_office")}
          storeId={storeMode ? selectedStoreId : undefined}
        />
      }
      isConfigured
      canManage={!storeMode && session.roles.includes("product_office")}
      stores={stores.map(option)}
      products={products.filter((product) => product.active).map(option)}
      selectedStoreId={selectedStoreId}
      basePath={storeMode ? "/store/campaigns" : "/admin/campaigns"}
      campaigns={visibleCampaigns.slice(0, 20).map((campaign) => ({
        id: campaign.id,
        updated_at: String(campaign.updated_at),
        name: String(campaign.name),
        starts_at: String(campaign.starts_at),
        ends_at: String(campaign.ends_at),
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
  );
}
