export type AuthMode = "local" | "supabase";

function configuredValue(name: string): string {
  return process.env[name]?.trim() || "";
}

function isPlaceholder(value: string): boolean {
  return !value || value.includes("[ref]") || value.includes("...");
}

/**
 * Production must use Supabase Auth. Keeping this validation in the auth
 * module makes a misconfigured production server fail during startup/module
 * initialization instead of silently serving local or guest authentication.
 */
export function assertProductionAuthConfiguration(): void {
  if (process.env.NODE_ENV !== "production") return;

  const mode = configuredValue("AUTH_MODE").toLowerCase();
  const url = configuredValue("NEXT_PUBLIC_SUPABASE_URL");
  const anon = configuredValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const problems: string[] = [];

  if (mode !== "supabase") {
    problems.push("AUTH_MODE must be set to 'supabase'");
  }
  if (isPlaceholder(url) || !url.startsWith("https://")) {
    problems.push("NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL");
  }
  if (isPlaceholder(anon)) {
    problems.push("NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured");
  }

  if (problems.length) {
    throw new Error(
      `Invalid production authentication configuration: ${problems.join(
        "; "
      )}. Refusing to enable local or guest authentication.`
    );
  }
}

export function getAuthMode(): AuthMode {
  if (process.env.NODE_ENV === "production") {
    assertProductionAuthConfiguration();
    return "supabase";
  }

  const forced = configuredValue("AUTH_MODE").toLowerCase();
  if (forced === "local") return "local";
  if (forced === "supabase") return "supabase";
  return isSupabaseConfigured() ? "supabase" : "local";
}

export function isSupabaseConfigured(): boolean {
  const url = configuredValue("NEXT_PUBLIC_SUPABASE_URL");
  const anon = configuredValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (isPlaceholder(url) || isPlaceholder(anon)) return false;
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

if (process.env.NODE_ENV === "production" && typeof window === "undefined") {
  assertProductionAuthConfiguration();
}
