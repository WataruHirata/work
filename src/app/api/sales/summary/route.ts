import { NextResponse } from "next/server";
import { getSalesSummary } from "@/server/queries/sales-analytics";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  if (!from || !to) {
    return NextResponse.json({ error: "from と to は必須です" }, { status: 400 });
  }

  const summary = await getSalesSummary({
    storeId,
    from,
    to,
  });

  return NextResponse.json({ summary });
}
