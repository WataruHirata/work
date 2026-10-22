import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ records: vi.fn() }));
vi.mock("@/server/queries/workspaces", () => ({ allRecords: mocks.records }));
vi.mock("@/components/notifications/notification-inbox", () => ({
  NotificationInbox: () => createElement("section", null, "個人宛通知テスト"),
}));
vi.mock("@/components/notifications/notification-button", () => ({
  NotificationButton: ({ unread, children }: { unread: number; children: ReactNode }) =>
    createElement("div", { "data-unread": unread }, children),
}));
import { AdminNotifications } from "@/components/notifications/admin-notifications";

describe("管理画面の通知 FR-029 AT-10", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("全ページ分を取得し未読件数と通知一覧を渡す", async () => {
    mocks.records.mockResolvedValue([
      { id: "1", read_at: null },
      { id: "2", read_at: "2026-10-22" },
    ]);
    const html = renderToStaticMarkup(
      await AdminNotifications({ configured: true, roles: ["area_manager"] }),
    );
    expect(html).toContain('data-unread="1"');
    expect(html).toContain("個人宛通知テスト");
    expect(mocks.records).toHaveBeenCalledWith("notifications");
  });
  it("取得失敗を一覧内に案内する", async () => {
    mocks.records.mockRejectedValue(new Error("接続失敗"));
    const html = renderToStaticMarkup(await AdminNotifications({ configured: true, roles: [] }));
    expect(html).toContain("通知を取得できませんでした");
  });
  it("未接続では通知を取得しない", async () => {
    const html = renderToStaticMarkup(await AdminNotifications({ configured: false, roles: [] }));
    expect(mocks.records).not.toHaveBeenCalled();
    expect(html).toContain("プレビュー表示です");
  });
});
