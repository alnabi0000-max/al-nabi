/**
 * Supabase identity → Prisma `AuthProvider` mapping.
 */

import type { AuthProvider } from "@prisma/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const PROVIDER_BY_SUPABASE_ID: Record<string, AuthProvider> = {
  google: "GOOGLE",
  apple: "APPLE",
  email: "MAGIC_LINK",
};

/**
 * Resolve the provider from a Supabase user record.
 *
 * Supabase reports both magic-link and 6-digit OTP sign-ins as the `email`
 * provider, so callers that know which passwordless flow ran should pass
 * `preferred` to keep the distinction.
 */
export function resolveAuthProvider(
  user: Pick<SupabaseUser, "app_metadata" | "identities"> | null | undefined,
  preferred?: AuthProvider
): AuthProvider {
  const raw =
    (user?.app_metadata?.provider as string | undefined) ||
    user?.identities?.[0]?.provider;
  const mapped = raw ? PROVIDER_BY_SUPABASE_ID[raw.toLowerCase()] : undefined;

  // A social identity always wins: it is unambiguous and cannot be inferred
  // from the flow the request happened to use.
  if (mapped && mapped !== "MAGIC_LINK") return mapped;
  return preferred || mapped || "MAGIC_LINK";
}
