import { notFound } from "next/navigation";
import { DataWorkspace, type WorkspaceSearch } from "@/components/workspaces/data-workspace";
import { adminFeatures } from "@/domain/access-policy";
import { requireAdminFeature } from "@/server/auth/admin-access";

export default async function AdminFeaturePage({
  params,
  searchParams,
}: {
  params: Promise<{ feature: string }>;
  searchParams: Promise<WorkspaceSearch>;
}) {
  const { feature } = await params;
  const page = adminFeatures.find((id) => id === feature);
  if (!page) notFound();
  await requireAdminFeature(page);
  return <DataWorkspace feature={page} search={await searchParams} />;
}
