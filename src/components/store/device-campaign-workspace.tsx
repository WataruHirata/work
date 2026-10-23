import { PageLayout } from "@/components/ui/page-layout";
import { StoreCampaignTaskBoard } from "@/components/campaigns/store-campaign-task-board";
import type { DataRecord, Json } from "@/domain/contracts";

function rows(value: Json | undefined): DataRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) =>
    row && typeof row === "object" && !Array.isArray(row) && typeof row.id === "string"
      ? [row as DataRecord]
      : [],
  );
}

export function DeviceCampaignWorkspace({ snapshot }: { snapshot: Record<string, Json> }) {
  const store =
    snapshot.store && typeof snapshot.store === "object" && !Array.isArray(snapshot.store)
      ? snapshot.store
      : null;
  const storeId = store && typeof store.id === "string" ? store.id : "";
  const instructions = rows(snapshot.instructions);
  const instructionTargets: DataRecord[] = instructions.map((instruction) => ({
    id: `${instruction.id}:${storeId}`,
    instruction_id: instruction.id,
    store_id: storeId,
    confirmed_at: instruction.confirmed_at ?? null,
  }));
  const products = [
    ...new Map(
      instructions.map((instruction) => [
        String(instruction.product_id),
        {
          id: String(instruction.product_id),
          code: instruction.product_code ?? "",
          name: instruction.product_name ?? "",
        } satisfies DataRecord,
      ]),
    ).values(),
  ];

  return (
    <PageLayout page="storeCampaigns">
      <StoreCampaignTaskBoard
        storeId={storeId}
        instructions={instructions}
        instructionTargets={instructionTargets}
        products={products}
        campaigns={[]}
        campaignItems={[]}
        campaignTargets={[]}
        tasks={[]}
      />
    </PageLayout>
  );
}
