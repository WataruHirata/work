import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function redirectWithCookies(url: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url && !anonKey) {
    if (process.env.VERCEL_ENV === "production") {
      throw new Error("Supabase authentication must be configured before serving the production app.");
    }
    return NextResponse.next({ request });
  }
  if (!url || !anonKey) {
    throw new Error("Both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.");
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    throw new Error("Unable to validate the current Supabase session.", { cause: error });
  }

  const pathname = request.nextUrl.pathname;
  const isPublicPath = pathname === "/login" || pathname.startsWith("/auth/");
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from("app_users")
      .select("active")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      throw new Error("Unable to load the current user's access profile.", { cause: profileError });
    }

    const { data: role, error: roleError } = await supabase
      .from("user_role_assignments")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (roleError) {
      throw new Error("Unable to load the current user's role assignments.", { cause: roleError });
    }

    if (!profile?.active || !role) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        throw new Error("Unable to sign out an inactive or unassigned user.", {
          cause: signOutError,
        });
      }
      return redirectWithCookies(new URL("/login?error=access", request.url), response);
    }
  }

  if (!user && !isPublicPath) {
    return redirectWithCookies(new URL("/login", request.url), response);
  }
  if (user && pathname === "/login") {
    return redirectWithCookies(new URL("/", request.url), response);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
