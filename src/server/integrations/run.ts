import "server-only";
import { integrationRuntime, integrationStore } from "@/server/container";
import { runIntegrationBatch } from "@/server/integrations/worker";

export async function runConfiguredIntegrations() {
  const { transport, kinds } = integrationRuntime();
  return runIntegrationBatch(integrationStore(), transport, kinds);
}
