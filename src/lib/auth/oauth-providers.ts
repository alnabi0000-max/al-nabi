import { isPlaceholderEnvValue } from "@/lib/env";

export type SocialOAuthProvider = "google" | "apple";

const DEFAULT_PROBE_TIMEOUT_MS = 2500;

/**
 * The Google button must only hide itself when GoTrue says the provider is
 * disabled. A 503 from our own rate limiter, a timeout, or a malformed probe
 * must not be treated as "coming soon".
 */
export function shouldOfferGoogleOAuth(probe: { google?: boolean } | null): boolean {
  return probe?.google !== false;
}

function supabaseAuthOrigin(): { url: string; anon: string } | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (
    isPlaceholderEnvValue(url) ||
    isPlaceholderEnvValue(anon) ||
    (!url.startsWith("https://") && !url.startsWith("http://"))
  ) {
    return null;
  }
  return { url, anon };
}

/**
 * Probe GoTrue without sending the user away.
 * Disabled providers return HTTP 400 + "provider is not enabled".
 * A hung Apple check must never block Google — callers pass a short timeout.
 */
export async function isOAuthProviderEnabled(
  provider: SocialOAuthProvider,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS
): Promise<boolean | null> {
  const cfg = supabaseAuthOrigin();
  if (!cfg) return false;

  try {
    const res = await fetch(
      `${cfg.url}/auth/v1/authorize?provider=${encodeURIComponent(provider)}`,
      {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          apikey: cfg.anon,
          Authorization: `Bearer ${cfg.anon}`,
        },
      }
    );

    if (res.status === 400) {
      const body = (await res.json().catch(() => null)) as {
        msg?: string;
        error_code?: string;
      } | null;
      const msg = `${body?.msg || ""} ${body?.error_code || ""}`.toLowerCase();
      if (msg.includes("not enabled") || msg.includes("unsupported provider")) {
        return false;
      }
    }

    if (res.status >= 300 && res.status < 400) return true;
    if (res.ok) return true;
    return null;
  } catch {
    return null;
  }
}
