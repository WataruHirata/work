export const GLOBAL_STORE_ACCESS_ROLES = [
  "information_systems",
  "product_office",
  "store_operations",
  "accounting",
] as const;

export type StoreRoleAssignment = {
  role: string;
  store_id: string | null;
  area_id: string | null;
};

export function canAccessStoreByAssignment(
  assignments: readonly StoreRoleAssignment[],
  storeId: string,
  areaId: string | null,
) {
  return assignments.some(
    (assignment) =>
      GLOBAL_STORE_ACCESS_ROLES.includes(
        assignment.role as (typeof GLOBAL_STORE_ACCESS_ROLES)[number],
      ) ||
      assignment.store_id === storeId ||
      Boolean(areaId && assignment.area_id === areaId),
  );
}
