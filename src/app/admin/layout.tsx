import { requireAdminFeature } from "@/server/auth/admin-access";
import { AdminNotifications } from "@/components/notifications/admin-notifications";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminFeature();
  return (
    <>
      <AdminNotifications configured={session.status === "authorized"} roles={session.roles} />
      {children}
    </>
  );
}
