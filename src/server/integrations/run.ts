import "server-only";
import { createSupabaseServerClient } from "@/infrastructure/supabase/clients/server";
import { integrationRuntime, integrationStore } from "@/server/container";
import { runIntegrationBatch } from "@/server/integrations/worker";

export async function runConfiguredIntegrations() {
  const client = await createSupabaseServerClient();
  await client.rpc("refresh_campaign_timing_alerts");
  const { transport, kinds } = integrationRuntime();
  return runIntegrationBatch(integrationStore(), transport, kinds);
}
