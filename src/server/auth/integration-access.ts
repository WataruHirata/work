import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { readIntegrationJson } from "@/server/container";

export function integrationAuthorized(
  request: Request,
  secret?: string,
): boolean {
  if (!secret || secret.length < 32) return false;
  const actual = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!actual) return false;
  return timingSafeEqual(
    createHash("sha256").update(actual).digest(),
    createHash("sha256").update(secret).digest(),
  );
}

export const readBoundedJson = readIntegrationJson;
