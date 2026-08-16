import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/auth/config";

/**
 * Cookie-free Supabase client for native (iOS / Android) requests.
 *
 * Native clients keep their own tokens in secure storage, so this client must
 * not read or write browser cookies — otherwise a mobile call would overwrite
 * the web session of whoever shares the same request context.
 */
export async function createStatelessClient(
  accessToken?: string
): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  const { createClient } = await import("@supabase/supabase-js");

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      ...(accessToken
        ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
        : {}),
    }
  );
}
