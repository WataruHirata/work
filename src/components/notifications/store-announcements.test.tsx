import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  records: vi.fn(),
  configured: vi.fn(),
  token: vi.fn(),
  snapshot: vi.fn(),
}));
vi.mock("@/server/container", () => ({
  identity: () => ({ session: mocks.session }),
  backendConfigured: mocks.configured,
}));
vi.mock("@/server/queries/workspaces", () => ({ allRecords: mocks.records }));
vi.mock("@/server/auth/store-context", () => ({
  deviceToken: mocks.token,
  deviceSnapshot: mocks.snapshot,
}));
vi.mock("@/components/notifications/notification-button", () => ({
  NotificationButton: ({
    unread,
    label,
    dialogTitle,
    countLabel,
    children,
  }: {
    unread: number;
    label: string;
    dialogTitle: string;
    countLabel: string;
    children: ReactNode;
  }) =>
    createElement(
      "section",
      {
        "data-unread": unread,
        "data-label": label,
        "data-title": dialogTitle,
        "data-count-label": countLabel,
      },
      children,
    ),
}));

import { StoreAnnouncements } from "@/components/notifications/store-announcements";
import { storeNotificationDestination } from "@/components/notifications/store-notification-route";

describe("店舗向けお知らせ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configured.mockReturnValue(true);
    mocks.token.mockResolvedValue(null);
  });

  it("割当店舗のお知らせだけを通知レイアウトで表示する", async () => {
    mocks.session.mockResolvedValue({
      active: true,
      mustChangePassword: false,
      storeIds: ["store-1"],
    });
    mocks.records.mockResolvedValue([
      { id: "a1", title: "価格変更", message: "明日から変更", created_at: "2026-10-22" },
    ]);
    const html = renderToStaticMarkup(await StoreAnnouncements());
    expect(mocks.records).toHaveBeenCalledWith("announcements", { storeId: "store-1" });
    expect(html).toContain('data-label="通知"');
    expect(html).toContain('data-title="店舗向け通知"');
    expect(html).toContain('data-count-label="店舗宛"');
    expect(html).toContain("価格変更");
    expect(html).toContain("明日から変更");
    expect(html).toContain('href="/store/campaigns"');
    expect(html).toContain("特売・価格を開く");
    expect(html).not.toContain("個人宛");
  });

  it("店舗端末だけが登録された状態でも登録店舗の通知を表示する", async () => {
    mocks.token.mockResolvedValue("a".repeat(64));
    mocks.snapshot.mockResolvedValue({
      notices: [
        { id: "a2", title: "店舗端末向け", message: "確認してください", created_at: "2026-10-23" },
      ],
    });
    mocks.session.mockResolvedValue(null);
    const html = renderToStaticMarkup(await StoreAnnouncements());
    expect(html).toContain('data-label="通知"');
    expect(html).toContain("店舗端末向け");
    expect(html).toContain('href="/store/notices"');
    expect(mocks.records).not.toHaveBeenCalled();
  });

  it("店舗端末の取得に失敗しても通知ボタンを残す", async () => {
    mocks.token.mockResolvedValue("a".repeat(64));
    mocks.snapshot.mockRejectedValue(new Error("unavailable"));
    const html = renderToStaticMarkup(await StoreAnnouncements());
    expect(html).toContain('data-label="通知"');
    expect(html).toContain("お知らせを取得できませんでした");
  });

  it("店舗端末も店舗セッションもない場合は何も表示しない", async () => {
    mocks.session.mockResolvedValue(null);
    expect(await StoreAnnouncements()).toBeNull();
    expect(mocks.records).not.toHaveBeenCalled();
  });
});

describe("店舗通知の遷移先", () => {
  it.each([
    ["価格変更", "確認してください", "/store/campaigns"],
    ["売上修正", "差し戻されました", "/store/sales"],
    ["棚卸予定", "18時開始", "/store/inventory"],
    ["納品時間の変更", "30分遅延", "/store/orders"],
    ["営業時間の確認", "22時30分閉店", "/store/notices"],
  ])("%sを対応画面へ結び付ける", (title, message, href) => {
    expect(storeNotificationDestination(title, message).href).toBe(href);
  });
});
