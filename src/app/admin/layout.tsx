import { getAdminSession } from "@/server/auth/admin-access";
import { AdminNotifications } from "@/components/notifications/admin-notifications";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  return (
    <>
      <AdminNotifications configured={session.status === "authorized"} roles={session.roles} />
      {children}
    </>
  );
}
