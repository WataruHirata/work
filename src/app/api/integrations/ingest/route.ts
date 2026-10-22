import { NextResponse } from "next/server";
import { integrationStore } from "@/server/container";
import { integrationAuthorized, readBoundedJson } from "@/server/auth/integration-access";
import type { Json } from "@/domain/contracts";
import { integrationIngestSecret } from "@/server/container";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!integrationAuthorized(request, integrationIngestSecret()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const data = await readBoundedJson(request);
    if (
      !data ||
      typeof data !== "object" ||
      !("version" in data) ||
      data.version !== 1 ||
      !("kind" in data) ||
      typeof data.kind !== "string" ||
      !["inventory", "prices", "sales"].includes(data.kind) ||
      !("eventId" in data) ||
      typeof data.eventId !== "string" ||
      !data.eventId ||
      data.eventId.length > 200 ||
      !("rows" in data) ||
      !Array.isArray(data.rows) ||
      !data.rows.length ||
      data.rows.length > 10000
    )
      throw new Error("連携データの形式が不正です。");
    return NextResponse.json({
      ok: true,
      result: await integrationStore().ingest(data.eventId, data.kind, data.rows as Json[]),
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "取込結果を確認できませんでした。イベント・形式・参照マスタを確認し、同じイベントID・同じ内容で再送してください。",
      },
      { status: 400 },
    );
  }
}
