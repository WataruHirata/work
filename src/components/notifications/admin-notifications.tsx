import { NotificationButton } from "@/components/notifications/notification-button";
import { NotificationInbox } from "@/components/notifications/notification-inbox";
import { allRecords } from "@/server/queries/workspaces";
import type { DataRecord } from "@/domain/contracts";

export async function AdminNotifications({
  configured,
  roles,
}: {
  configured: boolean;
  roles: string[];
}) {
  let rows: DataRecord[] = [];
  let failed = false;
  if (configured) {
    try {
      rows = await allRecords("notifications");
    } catch {
      failed = true;
    }
  }
  return (
    <div className="admin-notification-toolbar">
      <NotificationButton unread={rows.filter((row) => !row.read_at).length}>
        {!configured ? (
          <p className="notification-feedback">
            プレビュー表示です。接続・ログイン後に個人宛の通知を表示します。
          </p>
        ) : failed ? (
          <p className="notification-feedback" role="alert">
            通知を取得できませんでした。時間をおいて画面を再読み込みしてください。
          </p>
        ) : (
          <NotificationInbox
            data={{ rows, total: rows.length, page: 1, pageSize: rows.length }}
            roles={roles}
          />
        )}
      </NotificationButton>
    </div>
  );
}
