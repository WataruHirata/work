import { describe, expect, it } from "vitest";
import {
  adminFeatures,
  canUseAdminFeature,
  hasAdminAccess,
  isAdminPath,
  safeAdminReturnPath,
} from "@/domain/access-policy";

describe("FR-028 / FR-034 / FR-035 / AT-10 管理ルートの権限境界", () => {
  it("店舗入口・ログイン・旧ルートを管理ルートとして扱わない", () => {
    for (const path of ["/", "/store", "/store/operations", "/login", "/sales", "/administrator"])
      expect(isAdminPath(path)).toBe(false);
    for (const path of ["/admin", "/admin/sales", "/admin/users"])
      expect(isAdminPath(path)).toBe(true);
  });
  it("未認証・店舗ロール・未知のロールには上位権限を付与しない", () => {
    for (const roles of [
      [],
      ["staff"],
      ["department_lead"],
      ["store_manager"],
      ["unknown"],
      ["executive"],
      ["product_office_head"],
      ["constructor"],
      ["__proto__"],
    ]) {
      expect(hasAdminAccess(roles)).toBe(false);
      for (const feature of adminFeatures) expect(canUseAdminFeature(roles, feature)).toBe(false);
    }
  });
  it("図の権限表を既存のDBロールへ対応付ける（メニュー利用のみ）", () => {
    const expected = {
      area_manager: ["sales", "products", "campaigns", "approvals"],
      store_operations: ["sales", "products", "campaigns", "orders", "approvals"],
      accounting: ["sales", "approvals", "monthly"],
      product_office: ["sales", "products", "campaigns"],
      information_systems: ["campaigns", "stores", "imports", "users", "audit"],
    };
    for (const [role, allowed] of Object.entries(expected)) {
      expect(adminFeatures.filter((feature) => canUseAdminFeature([role], feature))).toEqual(
        allowed,
      );
    }
    expect(canUseAdminFeature(["area_manager", "information_systems"], "users")).toBe(true);
  });
  it("ログインの戻り先を既知の管理ルートに限定する", () => {
    expect(safeAdminReturnPath("/admin/campaigns")).toBe("/admin/campaigns");
    for (const value of [
      undefined,
      "",
      "https://example.org",
      "//example.org",
      "/admin/../../outside",
      "/admin/%2e%2e",
      "/admin\\evil",
      "/admin?next=evil",
      "/admin/unknown",
      "/store",
    ])
      expect(safeAdminReturnPath(value)).toBe("/admin");
  });
});
