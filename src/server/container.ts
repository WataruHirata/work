import "server-only";
import type {
  BusinessRepository,
  IdentityProvider,
  IntegrationJobStore,
  IntegrationTransport,
} from "@/domain/contracts";
import { SupabaseRepository } from "@/infrastructure/supabase/adapter";
import { SupabaseIntegrationStore } from "@/infrastructure/supabase/integration-store";
import {
  LocalRepository,
  LocalIdentity,
  LocalIntegrationStore,
} from "@database/mock/pglite/adapter";
import { mockCronSecret, mockIngestToken } from "@database/mock/pglite/adapter";
import { MysqlRepository, MysqlIdentity } from "@database/mysql/repository";
import { MysqlIntegrationStore } from "@database/mysql/integration-store";
import { mysqlConnectionConfigured } from "@database/mysql/config";
export { readBoundedJson as readIntegrationJson } from "@/infrastructure/integrations/bounded-json";
import {
  configuredTargets,
  HttpIntegrationTransport,
} from "@/infrastructure/integrations/http-transport";
import { MockCoreSystemTransport } from "../../mock-core-system/transport";

export function isSupabaseProvider() {
  return process.env.DATABASE_PROVIDER === "supabase";
}
export function isMysqlProvider() {
  return process.env.DATABASE_PROVIDER === "mysql";
}

// Replace these factories to change the database/auth provider. UI and use cases stay intact.
export function repository(): BusinessRepository {
  if (isMysqlProvider()) return new MysqlRepository();
  return isSupabaseProvider() ? new SupabaseRepository() : new LocalRepository();
}
export function identity(): IdentityProvider {
  // Authentication is owned by this Next.js application and its local identity store.
  if (isMysqlProvider()) return new MysqlIdentity();
  return new LocalIdentity();
}
export function integrationStore(): IntegrationJobStore {
  if (isMysqlProvider()) return new MysqlIntegrationStore();
  return isSupabaseProvider() ? new SupabaseIntegrationStore() : new LocalIntegrationStore();
}
export function integrationRuntime(): {
  transport: IntegrationTransport;
  kinds: string[];
} {
  const targets = configuredTargets();
  const httpTransport = new HttpIntegrationTransport(targets);
  const configuredKinds = Object.entries(targets)
    .filter(([, target]) => target.url && target.token)
    .map(([kind]) => kind);
  const mockCoreEnabled =
    process.env.NODE_ENV !== "production" && process.env.MOCK_CORE_SYSTEM_ENABLED !== "false";
  if (mockCoreEnabled) {
    return {
      transport: new MockCoreSystemTransport(httpTransport),
      kinds: [...new Set(["order", ...configuredKinds])],
    };
  }
  if (!isSupabaseProvider() && !isMysqlProvider()) {
    return {
      transport: {
        async send(kind, idempotencyKey) {
          return { accepted: true, mode: "repository-mock", kind, reference: idempotencyKey };
        },
      },
      kinds: ["order", "campaign_price", "campaign_restore", "sales_import"],
    };
  }
  return {
    transport: httpTransport,
    kinds: configuredKinds,
  };
}
export function backendConfigured(): boolean {
  if (isMysqlProvider()) return mysqlConnectionConfigured();
  return (
    !isSupabaseProvider() ||
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function integrationRunSecret() {
  return isSupabaseProvider() || isMysqlProvider() ? process.env.CRON_SECRET : mockCronSecret;
}

export function integrationIngestSecret() {
  return isSupabaseProvider() || isMysqlProvider()
    ? process.env.INTEGRATION_INGEST_TOKEN
    : mockIngestToken;
}
