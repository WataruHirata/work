import { NextResponse } from "next/server";
import { getDashboardSnapshot, getMockApiKey } from "@/lib/supabase/data";

export async function GET(request: Request) {
  const apiKey = request.headers.get("x-api-key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expectedKey = getMockApiKey();

  if (apiKey && apiKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getDashboardSnapshot();
  return NextResponse.json({
    ok: true,
    data,
    meta: {
      source: process.env.NEXT_PUBLIC_SUPABASE_URL ? "supabase" : "mock",
      generatedAt: new Date().toISOString(),
    },
  });
}
