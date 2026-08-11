/**
 * Auth rejimlari:
 * - local  → HttpOnly cookie + storage/local-users.json (Supabase shart emas)
 * - supabase → real Supabase Auth (URL/ANON to‘ldirilganda)
 */

export type AuthMode = "local" | "supabase";

export function getAuthMode(): AuthMode {
  const forced = process.env.AUTH_MODE?.toLowerCase();
  if (forced === "local") return "local";
  if (forced === "supabase") return "supabase";
  return isSupabaseConfigured() ? "supabase" : "local";
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  if (!url || !anon) return false;
  if (url.includes("[ref]") || anon.includes("...")) return false;
  return url.startsWith("https://") || url.startsWith("http://");
}

export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
  return Boolean(key) && !key.includes("...");
}

const DEV_FALLBACK_AUTH_SECRET = "alnabiy-local-dev-secret-change-me-32b";

export function getAuthSecret(): string {
  const configured = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET (or NEXTAUTH_SECRET) must be set to a random value of at least 32 characters in production — refusing to sign cookies with the dev fallback secret."
    );
  }
  return configured || DEV_FALLBACK_AUTH_SECRET;
}
