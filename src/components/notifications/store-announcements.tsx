import "server-only";
import Link from "next/link";
import { backendConfigured, identity } from "@/server/container";
import { allRecords } from "@/server/queries/workspaces";
import { deviceSnapshot, deviceToken } from "@/server/auth/store-context";
import type { DataRecord, Json } from "@/domain/contracts";
import { NotificationButton } from "./notification-button";
import { ArrowRight } from "@/components/ui/icons";
import { storeNotificationDestination } from "./store-notification-route";

function snapshotAnnouncements(value: Json | undefined): DataRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.id !== "string")
      return [];
    return [{ id: item.id, ...item }];
  });
}

export async function StoreAnnouncements() {
  if (!backendConfigured()) return null;
  let announcements: DataRecord[] = [];
  let failed = false;
  const token = await deviceToken();
  if (token) {
    try {
      announcements = snapshotAnnouncements((await deviceSnapshot())?.notices);
    } catch {
      failed = true;
    }
  } else {
    const session = await identity().session();
    const storeId =
      session?.active && !session.mustChangePassword ? session.storeIds?.[0] : undefined;
    if (!storeId) return null;
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
        label="通知"
        countLabel="店舗宛"
        dialogTitle="店舗向け通知"
      >
        {failed ? (
          <p>お知らせを取得できませんでした。</p>
        ) : announcements.length === 0 ? (
          <p>店舗宛のお知らせはありません。</p>
        ) : (
          <div className="store-notification-list">
            {announcements.map((announcement) => {
              const title = String(announcement.title ?? "");
              const message = String(announcement.message ?? "");
              const createdAt = String(announcement.created_at ?? "");
              const destination = storeNotificationDestination(title, message);
              const date = new Date(createdAt);
              const displayDate = Number.isNaN(date.getTime())
                ? createdAt
                : date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
              return (
                <Link
                  className="store-notification-card"
                  href={destination.href}
                  key={announcement.id}
                >
                  <article>
                    <div className="store-notification-card-heading">
                      <h3>{title}</h3>
                      <time dateTime={createdAt}>{displayDate}</time>
                    </div>
                    <p>{message}</p>
                    <span className="store-notification-destination">
                      {destination.label}
                      <ArrowRight size={15} aria-hidden="true" />
                    </span>
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </NotificationButton>
    </div>
  );
}
