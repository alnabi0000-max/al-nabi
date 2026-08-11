import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { supabaseCookieOptions } from "@/lib/auth/session-ttl";

/**
 * Brauzer Supabase client — 365 kunlik persistent cookies.
 */
export function createClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseCookieOptions(
        typeof window !== "undefined"
          ? window.location.protocol === "https:"
          : process.env.NODE_ENV === "production"
      ),
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    }
  );
}
