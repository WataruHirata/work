import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), records: vi.fn(), configured: vi.fn() }));
vi.mock("@/server/container", () => ({
  identity: () => ({ session: mocks.session }),
  backendConfigured: mocks.configured,
}));
vi.mock("@/server/queries/workspaces", () => ({ allRecords: mocks.records }));
vi.mock("@/components/ui/collapsible-list", () => ({
  CollapsibleList: ({ children }: { children: ReactNode }) => createElement("div", null, children),
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

describe("店舗向けお知らせ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configured.mockReturnValue(true);
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
    expect(html).toContain('data-label="お知らせ"');
    expect(html).toContain('data-title="店舗向けお知らせ"');
    expect(html).toContain('data-count-label="店舗宛"');
    expect(html).toContain("価格変更");
    expect(html).toContain("明日から変更");
    expect(html).not.toContain("個人宛");
  });

  it("店舗セッションがない場合は何も表示しない", async () => {
    mocks.session.mockResolvedValue(null);
    expect(await StoreAnnouncements()).toBeNull();
    expect(mocks.records).not.toHaveBeenCalled();
  });
});
