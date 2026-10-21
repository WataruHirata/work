import { NextResponse } from "next/server";
import { identity } from "@/server/container";
import { safeAdminReturnPath } from "@/domain/access-policy";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedPath = requestUrl.searchParams.get("next");
  const nextPath = safeAdminReturnPath(requestedPath);

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=auth", requestUrl.origin),
    );
  }

  try {
    await identity().exchangeCode(code);
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=auth", requestUrl.origin),
    );
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
