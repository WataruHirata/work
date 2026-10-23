import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/server/auth/admin-access", () => ({ requireAdminFeature: mocks.session }));
import AdminPage from "@/app/admin/page";
import { adminMenuFeatures } from "@/domain/access-policy";
import { uiConfig } from "@/config/ui";

describe("管理トップ FR-028/029 AT-10", () => {
  beforeEach(() => {
    mocks.session.mockResolvedValue({ status: "authorized", roles: ["area_manager"] });
  });
  it("申請・承認と権限不要の発注を除く8個の管理機能ボタンを表示する", async () => {
    const html = renderToStaticMarkup(await AdminPage());
    expect(adminMenuFeatures).toHaveLength(8);
    for (const feature of adminMenuFeatures) {
      expect(html).toContain(`href="${uiConfig.pages[feature].href}"`);
      expect(html).toContain(uiConfig.pages[feature].label);
    }
    expect(html).not.toContain(`href="${uiConfig.pages.approvals.href}"`);
    expect(html).not.toContain(uiConfig.pages.approvals.label);
    expect(html).not.toContain("/admin/orders");
  });
  it("通知本文は管理トップ本文に重複表示しない", async () => {
    const html = renderToStaticMarkup(await AdminPage());
    expect(html).not.toContain("notification-inbox-heading");
  });
});
