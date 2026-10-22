import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import {
  canUseAdminFeature,
  hasAdminAccess,
  isAdminRole,
  type AdminFeature,
} from "@/domain/access-policy";
import { backendConfigured, identity } from "@/server/container";
import { activeAdminRoleCookie } from "@/server/auth/admin-role";

export const getAdminSession = cache(async () => {
  if (!backendConfigured())
    return { status: "unconfigured" as const, roles: [] as string[], selectionRequired: false };
  const session = await identity().session();
  if (!session)
    return { status: "anonymous" as const, roles: [] as string[], selectionRequired: false };
  if (!session.active)
    return { status: "denied" as const, roles: [] as string[], selectionRequired: false };
  if (session.mustChangePassword) redirect("/account/password");
  const assignedRoles = session.roles.filter(isAdminRole);
  const selectedRole = (await cookies()).get(activeAdminRoleCookie)?.value;
  const selectedRoles =
    selectedRole && assignedRoles.includes(selectedRole as (typeof assignedRoles)[number])
      ? [selectedRole]
      : [];
  return {
    status: hasAdminAccess(selectedRoles) ? ("authorized" as const) : ("denied" as const),
    roles: selectedRoles,
    selectionRequired: assignedRoles.length > 0 && selectedRoles.length === 0,
  };
});
export async function requireAdminFeature(feature?: AdminFeature) {
  const session = await getAdminSession();
  if (session.status === "unconfigured") return session;
  if (session.status === "anonymous")
    redirect(`/login?next=${encodeURIComponent(feature ? `/admin/${feature}` : "/admin")}`);
  if (session.status === "denied" && session.selectionRequired)
    redirect(`/login?next=${encodeURIComponent(feature ? `/admin/${feature}` : "/admin")}`);
  if (session.status !== "authorized" || (feature && !canUseAdminFeature(session.roles, feature)))
    notFound();
  return session;
}
