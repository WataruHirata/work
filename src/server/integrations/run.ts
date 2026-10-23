import "server-only";
import {
  integrationRuntime,
  integrationStore,
  refreshCampaignTimingAlerts,
} from "@/server/container";
import { runIntegrationBatch } from "@/server/integrations/worker";

export async function runConfiguredIntegrations() {
  await refreshCampaignTimingAlerts();
  const { transport, kinds } = integrationRuntime();
  return runIntegrationBatch(integrationStore(), transport, kinds);
}
