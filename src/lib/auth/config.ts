import {
  isPlaceholderEnvValue,
  shouldEnforceProductionSecrets,
} from "@/lib/env";

export type AuthMode = "local" | "supabase";

function configuredValue(name: string): string {
  return process.env[name]?.trim() || "";
}

/**
 * Production must use Supabase Auth. Keeping this validation in the auth
 * module makes a misconfigured production server fail during startup/module
 * initialization instead of silently serving local or guest authentication.
 *
 * Local development (`NODE_ENV === "development"`) and local `next build`
 * against placeholder keys are allowed. Fail-closed is production-only.
 */
export function assertProductionAuthConfiguration(): void {
  if (!shouldEnforceProductionSecrets()) return;

  const mode = configuredValue("AUTH_MODE").toLowerCase();
  const url = publicSupabaseUrl();
  const anon = publicSupabaseAnonKey();
  const problems: string[] = [];

  if (mode !== "supabase") {
    problems.push("AUTH_MODE must be set to 'supabase'");
  }
  if (isPlaceholderEnvValue(url) || !url.startsWith("https://")) {
    problems.push("NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL");
  }
  if (isPlaceholderEnvValue(anon)) {
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

/**
 * Public Supabase values must be read as static `process.env.NEXT_PUBLIC_*`
 * identifiers. Next.js inlines those into the browser bundle; `process.env[name]`
 * is always empty on the client, which made Google/Apple look "unconfigured".
 */
function publicSupabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
}

function publicSupabaseAnonKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
}

export function isSupabaseConfigured(): boolean {
  const url = publicSupabaseUrl();
  const anon = publicSupabaseAnonKey();
  if (isPlaceholderEnvValue(url) || isPlaceholderEnvValue(anon)) return false;
  return url.startsWith("https://") || url.startsWith("http://");
}

export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
  return Boolean(key) && !isPlaceholderEnvValue(key);
}

export function getStripePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || "";
  if (isPlaceholderEnvValue(key)) return "";
  return key.startsWith("pk_") ? key : "";
}

const DEV_FALLBACK_AUTH_SECRET = "alnabiy-local-dev-secret-change-me-32b";

export function getAuthSecret(): string {
  const configured = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (
    configured &&
    configured.length >= 32 &&
    !isPlaceholderEnvValue(configured)
  ) {
    return configured;
  }
  if (shouldEnforceProductionSecrets()) {
    throw new Error(
      "AUTH_SECRET (or NEXTAUTH_SECRET) must be set to a random value of at least 32 characters in production — refusing to sign cookies with the dev fallback secret."
    );
  }
  return configured && configured.length >= 32
    ? configured
    : configured || DEV_FALLBACK_AUTH_SECRET;
}

if (typeof window === "undefined") {
  assertProductionAuthConfiguration();
}
