import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — faqat serverda (webhook, sync, admin).
 * Anon kalit bilan chalkashtirmang.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin env missing (URL / SERVICE_ROLE_KEY)");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
