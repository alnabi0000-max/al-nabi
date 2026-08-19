import { isPlaceholderEnvValue } from "@/lib/env";

export type SocialOAuthProvider = "google" | "apple";

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
 */
export async function isOAuthProviderEnabled(
  provider: SocialOAuthProvider
): Promise<boolean | null> {
  const cfg = supabaseAuthOrigin();
  if (!cfg) return false;

  try {
    const res = await fetch(
      `${cfg.url}/auth/v1/authorize?provider=${encodeURIComponent(provider)}`,
      {
        method: "GET",
        redirect: "manual",
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
