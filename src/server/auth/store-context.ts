import "server-only";
import { cookies } from "next/headers";
import { backendConfigured, repository } from "@/server/container";

export const stationCookie = "minoriya-station";
export async function deviceSnapshot() {
  if (!backendConfigured()) return null;
  const token = (await cookies()).get(stationCookie)?.value;
  if (!token) return null;
  return repository().storeSnapshot(token);
}
