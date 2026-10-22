import "server-only";
import { cookies } from "next/headers";
import { backendConfigured, repository } from "@/server/container";

export const stationCookie = "minoriya-station";
export async function deviceToken() {
  return (await cookies()).get(stationCookie)?.value ?? null;
}
export async function deviceSnapshot() {
  if (!backendConfigured()) return null;
  const token = await deviceToken();
  if (!token) return null;
  return repository().storeSnapshot(token);
}
