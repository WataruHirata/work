import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import LegacyAdminOrdersPage from "@/app/admin/orders/page";

describe("legacy admin orders route", () => {
  beforeEach(() => mocks.redirect.mockClear());

  it("sends the old admin URL to the permission-free store order page", () => {
    LegacyAdminOrdersPage();
    expect(mocks.redirect).toHaveBeenCalledWith("/store/orders");
  });
});
