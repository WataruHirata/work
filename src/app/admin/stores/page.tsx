import { DataWorkspace, type WorkspaceSearch } from "@/components/workspaces/data-workspace";
import { requireAdminFeature } from "@/server/auth/admin-access";

export default async function Page({ searchParams }: { searchParams: Promise<WorkspaceSearch> }) {
  await requireAdminFeature("stores");
  return <DataWorkspace feature="stores" search={await searchParams} />;
}
