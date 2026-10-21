import "server-only";
import { repository } from "@/server/container";
import type { Json } from "@/domain/contracts";

export async function importProfiles(rows: Json[]) {
  await repository().execute("importProfiles", { p_rows: rows });
}
