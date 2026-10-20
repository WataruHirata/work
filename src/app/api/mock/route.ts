import { NextResponse } from "next/server";
import { MOCK_API_KEY, mockDashboardData } from "@/lib/mock-api";

export async function GET(request: Request) {
  const apiKey = request.headers.get("x-api-key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!apiKey || apiKey !== MOCK_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    data: mockDashboardData,
    meta: {
      apiKey: MOCK_API_KEY,
      mode: "mock",
      generatedAt: new Date().toISOString(),
    },
  });
}

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!apiKey || apiKey !== MOCK_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  return NextResponse.json({
    ok: true,
    message: "Mock API accepted payload",
    received: payload,
    meta: {
      apiKey: MOCK_API_KEY,
      mode: "mock",
      generatedAt: new Date().toISOString(),
    },
  });
}
