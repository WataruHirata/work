import { NextResponse } from "next/server";
import { getDashboardSnapshot, getMockApiKey } from "@/server/queries/dashboard";
import { getAdminSession } from "@/server/auth/admin-access";
import { canUseAdminFeature } from "@/domain/access-policy";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (session.status !== "authorized") {
    return NextResponse.json(
      { error: "管理機能のログインが必要です。" },
      { status: session.status === "denied" ? 403 : 401 },
    );
  }
  if (!canUseAdminFeature(session.roles, "sales")) {
    return NextResponse.json({ error: "売上参照権限が必要です。" }, { status: 403 });
  }
  const apiKey =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expectedKey = getMockApiKey();

  if (apiKey && apiKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getDashboardSnapshot();
  return NextResponse.json({
    ok: true,
    data,
    meta: {
      source: "database",
      generatedAt: new Date().toISOString(),
    },
  });
}
