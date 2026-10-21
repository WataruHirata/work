import { FeatureMenu } from "@/components/layout/feature-menu";
import { PageLayout } from "@/components/ui/page-layout";
import { adminFeatures, canUseAdminFeature } from "@/domain/access-policy";
import { requireAdminFeature } from "@/server/auth/admin-access";
import { repository } from "@/server/container";
import { NotificationInbox } from "@/components/notifications/notification-inbox";

export default async function AdminPage() {
  const session = await requireAdminFeature();
  if (session.status === "unconfigured")
    return (
      <PageLayout page="admin">
        <p className="page-panel">
          未接続の操作プレビューです。架空データで各機能の画面を確認できます。実データや本部の操作権限は付与されません。
        </p>
        <FeatureMenu pages={adminFeatures} />
      </PageLayout>
    );
  const notifications = await repository().list("notifications");
  return (
    <PageLayout page="admin">
      <NotificationInbox data={notifications} roles={session.roles} />
      <p className="page-panel">
        ログイン中の権限で利用できる機能を選択してください。
      </p>
      <FeatureMenu
        pages={adminFeatures.filter((feature) =>
          canUseAdminFeature(session.roles, feature),
        )}
      />
    </PageLayout>
  );
}
