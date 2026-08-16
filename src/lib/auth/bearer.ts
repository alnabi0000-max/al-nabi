/**
 * JWT Bearer token support for native clients (iOS / Android).
 *
 * The web app authenticates through HTTP-only Supabase cookies. Native apps
 * hold the access token in secure storage and send it as
 * `Authorization: Bearer <access_token>`; the refresh token is exchanged via
 * `POST /api/auth/session`.
 */

import { headers } from "next/headers";
import type { SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";
import { inspectAccessToken } from "@/lib/auth/jwt";
import { createStatelessClient } from "@/lib/supabase/stateless";

export type HeaderSource = { headers: Headers } | Headers | null | undefined;

function toHeaders(source: HeaderSource): Headers | null {
  if (!source) return null;
  if (source instanceof Headers) return source;
  return source.headers ?? null;
}

/** Extract the raw token from an `Authorization: Bearer …` header. */
export function readBearerToken(source: HeaderSource): string | null {
  const bag = toHeaders(source);
  if (!bag) return null;
  const raw = bag.get("authorization") || bag.get("Authorization");
  if (!raw) return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

/**
 * Read the bearer token without an explicit request object. Route handlers can
 * call this directly; it returns `null` outside a request scope.
 */
export async function readRequestBearerToken(
  source?: HeaderSource
): Promise<string | null> {
  const direct = readBearerToken(source);
  if (direct) return direct;
  try {
    return readBearerToken(await headers());
  } catch {
    return null;
  }
}

/** Supabase client bound to a single bearer token — no cookie mutation. */
export function createBearerClient(
  token: string
): Promise<SupabaseClient | null> {
  return createStatelessClient(token);
}

/**
 * Resolve a bearer token to a verified Supabase identity.
 *
 * Fail-closed: a malformed, expired, or rejected token yields `null` rather
 * than falling through to any weaker credential.
 */
export async function getBearerIdentity(
  token: string
): Promise<SupabaseUser | null> {
  const inspection = await inspectAccessToken(token);
  if (!inspection.valid) return null;

  try {
    const supabase = await createBearerClient(token);
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.id) return null;
    return data.user;
  } catch {
    return null;
  }
}
