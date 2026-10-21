import { requireAdminFeature } from "@/server/auth/admin-access";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminFeature();
  return children;
}
