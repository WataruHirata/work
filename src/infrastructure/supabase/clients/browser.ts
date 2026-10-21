import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
      },
    } as ReturnType<typeof createBrowserClient>;
  }

  return createBrowserClient(url, anonKey);
}
