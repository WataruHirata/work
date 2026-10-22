import { NextResponse } from "next/server";
import { integrationAuthorized } from "@/server/auth/integration-access";
import { runConfiguredIntegrations } from "@/server/integrations/run";
import { integrationRunSecret } from "@/server/container";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!integrationAuthorized(request, integrationRunSecret()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runConfiguredIntegrations());
  } catch {
    return NextResponse.json(
      {
        error: "連携処理を完了できませんでした。連携監視で状態を確認してください。",
      },
      { status: 503 },
    );
  }
}
export const GET = POST;
