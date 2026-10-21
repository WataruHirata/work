import "server-only";
import type { BusinessRepository, IdentityProvider, IntegrationJobStore, IntegrationTransport } from "@/domain/contracts";
import { SupabaseRepository, SupabaseIdentity } from "@/infrastructure/supabase/adapter";
import { SupabaseIntegrationStore } from "@/infrastructure/supabase/integration-store";
export { readBoundedJson as readIntegrationJson } from "@/infrastructure/integrations/bounded-json";
import { configuredTargets, HttpIntegrationTransport } from "@/infrastructure/integrations/http-transport";

// Replace these factories to change the database/auth provider. UI and use cases stay intact.
export function repository(): BusinessRepository { return new SupabaseRepository(); }
export function identity(): IdentityProvider { return new SupabaseIdentity(); }
export function integrationStore(): IntegrationJobStore { return new SupabaseIntegrationStore(); }
export function integrationRuntime(): { transport: IntegrationTransport; kinds: string[] } {
  const targets = configuredTargets();
  return {
    transport: new HttpIntegrationTransport(targets),
    kinds: Object.entries(targets).filter(([, target]) => target.url && target.token).map(([kind]) => kind),
  };
}
export function backendConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
