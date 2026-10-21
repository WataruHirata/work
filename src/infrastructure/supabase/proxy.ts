import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminPath, safeAdminReturnPath } from "@/domain/access-policy";

/** Provider-specific cookie refresh only. Data authorization belongs to repository/use cases. */
export async function refreshSupabaseSession(request: NextRequest) {
  if (process.env.DATABASE_PROVIDER !== "supabase")
    return NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url && !key) return NextResponse.next({ request });
  if (!url || !key) throw new Error("認証サービスの接続設定が不完全です。");
  let response = NextResponse.next({ request });
  if (
    !isAdminPath(request.nextUrl.pathname) &&
    !request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"))
  )
    return response;
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const value of values)
          request.cookies.set(value.name, value.value);
        response = NextResponse.next({ request });
        for (const value of values)
          response.cookies.set(value.name, value.value, value.options);
      },
    },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError")
    return new NextResponse(
      "認証サービスを確認できません。再度お試しください。",
      { status: 503 },
    );
  if (!user && isAdminPath(request.nextUrl.pathname)) {
    const login = new URL("/login", request.url);
    login.searchParams.set(
      "next",
      safeAdminReturnPath(request.nextUrl.pathname),
    );
    const redirect = NextResponse.redirect(login);
    for (const cookie of response.cookies.getAll())
      redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}
