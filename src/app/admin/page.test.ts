import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/server/auth/admin-access", () => ({ requireAdminFeature: mocks.session }));
import AdminPage from "@/app/admin/page";
import { adminFeatures } from "@/domain/access-policy";
import { uiConfig } from "@/config/ui";

describe("管理トップ FR-028/029 AT-10", () => {
  beforeEach(() => {
    mocks.session.mockResolvedValue({ status: "authorized", roles: ["area_manager"] });
  });
  it("初期表示で全管理機能へのボタンを表示する", async () => {
    const html = renderToStaticMarkup(await AdminPage());
    for (const feature of adminFeatures) {
      expect(html).toContain(`href="${uiConfig.pages[feature].href}"`);
      expect(html).toContain(uiConfig.pages[feature].label);
    }
  });
  it("通知本文は管理トップ本文に重複表示しない", async () => {
    const html = renderToStaticMarkup(await AdminPage());
    expect(html).not.toContain("notification-inbox-heading");
  });
});
