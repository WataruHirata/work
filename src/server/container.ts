import "server-only";
import type {
  BusinessRepository,
  IdentityProvider,
  IntegrationJobStore,
  IntegrationTransport,
} from "@/domain/contracts";
import {
  SupabaseRepository,
  SupabaseIdentity,
} from "@/infrastructure/supabase/adapter";
import { SupabaseIntegrationStore } from "@/infrastructure/supabase/integration-store";
import { LocalRepository, LocalIdentity, LocalIntegrationStore } from "@/infrastructure/pglite/adapter";
import { mockCronSecret, mockIngestToken } from "@/infrastructure/pglite/adapter";
export { readBoundedJson as readIntegrationJson } from "@/infrastructure/integrations/bounded-json";
import {
  configuredTargets,
  HttpIntegrationTransport,
} from "@/infrastructure/integrations/http-transport";

export function isSupabaseProvider() {
  return process.env.DATABASE_PROVIDER === "supabase";
}

// Replace these factories to change the database/auth provider. UI and use cases stay intact.
export function repository(): BusinessRepository {
  return isSupabaseProvider() ? new SupabaseRepository() : new LocalRepository();
}
export function identity(): IdentityProvider {
  return isSupabaseProvider() ? new SupabaseIdentity() : new LocalIdentity();
}
export function integrationStore(): IntegrationJobStore {
  return isSupabaseProvider() ? new SupabaseIntegrationStore() : new LocalIntegrationStore();
}
export function integrationRuntime(): {
  transport: IntegrationTransport;
  kinds: string[];
} {
  if (!isSupabaseProvider()) {
    return {
      transport: {
        async send(kind, idempotencyKey) {
          return { accepted: true, mode: "repository-mock", kind, reference: idempotencyKey };
        },
      },
      kinds: ["order", "campaign_price", "campaign_restore", "sales_import"],
    };
  }
  const targets = configuredTargets();
  return {
    transport: new HttpIntegrationTransport(targets),
    kinds: Object.entries(targets)
      .filter(([, target]) => target.url && target.token)
      .map(([kind]) => kind),
  };
}
export function backendConfigured(): boolean {
  return !isSupabaseProvider() || Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function integrationRunSecret() {
  return isSupabaseProvider() ? process.env.CRON_SECRET : mockCronSecret;
}

export function integrationIngestSecret() {
  return isSupabaseProvider() ? process.env.INTEGRATION_INGEST_TOKEN : mockIngestToken;
}
