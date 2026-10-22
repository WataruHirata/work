import { SalesWorkspace, type SalesSearch } from "@/components/sales/sales-workspace";
import { requireAdminFeature } from "@/server/auth/admin-access";

export default async function Page({ searchParams }: { searchParams: Promise<SalesSearch> }) {
  await requireAdminFeature("sales");
  return <SalesWorkspace search={await searchParams} />;
}
