/** Menu access follows docs/routes.md. Mutation permissions remain in RPC/RLS. */
export const adminFeatures = [
  "sales",
  "products",
  "campaigns",
  "orders",
  "approvals",
  "monthly",
  "stores",
  "imports",
  "users",
  "audit",
] as const;
export type AdminFeature = (typeof adminFeatures)[number];

/** 申請・承認は個人宛通知から対象申請を開くため、管理トップには重複表示しない。 */
export const adminMenuFeatures = adminFeatures.filter((feature) => feature !== "approvals");

const roleFeatures: Record<string, readonly AdminFeature[]> = {
  area_manager: ["sales", "products", "campaigns", "approvals"],
  store_operations: ["sales", "products", "campaigns", "orders", "approvals"],
  accounting: ["sales", "approvals", "monthly"],
  product_office: ["sales", "products", "campaigns"],
  information_systems: ["stores", "imports", "users", "audit"],
};

export function canUseAdminFeature(roles: readonly string[], feature: AdminFeature): boolean {
  return roles.some(
    (role) => Object.hasOwn(roleFeatures, role) && roleFeatures[role].includes(feature),
  );
}

export function hasAdminAccess(roles: readonly string[]): boolean {
  return adminFeatures.some((feature) => canUseAdminFeature(roles, feature));
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** Only redirect to known local admin paths, including callback input. */
export function safeAdminReturnPath(value?: string | null): string {
  if (!value || /[\\\s?#%]/.test(value)) return "/admin";
  if (
    [
      "/store/sales-inventory",
      "/store/orders",
      "/store/operations",
      "/store/campaigns",
      "/store/notices",
      "/account/password",
    ].includes(value)
  )
    return value;
  return value === "/admin" || adminFeatures.some((feature) => value === `/admin/${feature}`)
    ? value
    : "/admin";
}
