import "server-only";
import { CollapsibleList } from "@/components/ui/collapsible-list";
import { backendConfigured, identity } from "@/server/container";
import { allRecords } from "@/server/queries/workspaces";
import { NotificationButton } from "./notification-button";

export async function StoreAnnouncements() {
  const session = await identity().session();
  const storeId =
    session?.active && !session.mustChangePassword ? session.storeIds?.[0] : undefined;
  if (!storeId) return null;

  let announcements: Awaited<ReturnType<typeof allRecords>> = [];
  let failed = false;
  if (backendConfigured()) {
    try {
      announcements = await allRecords("announcements", { storeId });
    } catch {
      failed = true;
    }
  }
  announcements.sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  );

  return (
    <div className="admin-notification-toolbar store-notification-toolbar">
      <NotificationButton
        unread={announcements.length}
        label="お知らせ"
        countLabel="店舗宛"
        dialogTitle="店舗向けお知らせ"
      >
        {failed ? (
          <p>お知らせを取得できませんでした。</p>
        ) : announcements.length === 0 ? (
          <p>店舗宛のお知らせはありません。</p>
        ) : (
          <CollapsibleList className="notice-list">
            {announcements.map((announcement) => (
              <article className="notice-card" key={announcement.id}>
                <h3>{String(announcement.title ?? "")}</h3>
                <p>{String(announcement.message ?? "")}</p>
                <time dateTime={String(announcement.created_at ?? "")}>
                  {String(announcement.created_at ?? "")}
                </time>
              </article>
            ))}
          </CollapsibleList>
        )}
      </NotificationButton>
    </div>
  );
}
