import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { canUseAdminFeature, hasAdminAccess, type AdminFeature } from "@/domain/access-policy";
import { backendConfigured, identity } from "@/server/container";

export const getAdminSession = cache(async () => {
  if (!backendConfigured()) return { status: "unconfigured" as const, roles: [] as string[] };
  const session = await identity().session();
  if (!session) return { status: "anonymous" as const, roles: [] as string[] };
  if (!session.active) return { status: "denied" as const, roles: [] as string[] };
  if (session.mustChangePassword) redirect("/account/password");
  return { status: hasAdminAccess(session.roles) ? "authorized" as const : "denied" as const, roles: session.roles };
});
export async function requireAdminFeature(feature?: AdminFeature) {
  const session = await getAdminSession();
  if (session.status === "unconfigured") return session;
  if (session.status === "anonymous") redirect(`/login?next=${encodeURIComponent(feature ? `/admin/${feature}` : "/admin")}`);
  if (session.status !== "authorized" || (feature && !canUseAdminFeature(session.roles, feature))) notFound();
  return session;
}
