"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function hasDemoAuth() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("demo-auth") === "enabled";
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function checkSession() {
      if (pathname === "/login") {
        setReady(true);
        return;
      }

      if (hasDemoAuth()) {
        setReady(true);
        return;
      }

      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !anonKey) {
          setReady(true);
          return;
        }

        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!ignore && !session && pathname !== "/login") {
          router.replace("/login");
          return;
        }
      } catch {
        if (!ignore && pathname !== "/login") {
          router.replace("/login");
          return;
        }
      }

      if (!ignore) {
        setReady(true);
      }
    }

    checkSession();
    return () => {
      ignore = true;
    };
  }, [pathname, router]);

  if (!ready && pathname !== "/login") {
    return <div className="login-shell"><div className="login-card"><p className="login-description">認証状態を確認しています…</p></div></div>;
  }

  return <>{children}</>;
}
