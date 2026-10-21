import { CampaignWorkspace } from "@/components/campaigns/campaign-workspace";
import { requireAdminFeature } from "@/server/auth/admin-access";

export default async function Page({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  await requireAdminFeature("campaigns");
  return <CampaignWorkspace storeId={(await searchParams).store} />;
}
