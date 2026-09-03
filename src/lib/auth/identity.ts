/**
 * Normalize a Supabase Auth user into the Prisma onboarding identity.
 *
 * Google sometimes leaves `user.email` empty even when the address is on the
 * identity record (`user_metadata` / `identities[].identity_data`). Callers
 * that required `user.email` treated a successful Google sign-in as logged
 * out on the next `/api/auth/me` request.
 */

import type { AuthProvider } from "@prisma/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { resolveAuthProvider } from "@/lib/auth/providers";

export interface AuthIdentity {
  id: string; // Supabase auth.users UUID
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  authProvider?: AuthProvider;
  /** Skip the `lastLoginAt` write for background syncs that are not sign-ins. */
  touchLogin?: boolean;
}

type IdentityLike = {
  id?: string;
  email?: string | null;
  app_metadata?: { provider?: string } | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: Array<{
    provider?: string;
    identity_data?: Record<string, unknown> | null;
  }> | null;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function identityData(
  identity: NonNullable<IdentityLike["identities"]>[number] | undefined
): Record<string, unknown> {
  const data = identity?.identity_data;
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

export function fallbackAuthEmail(userId: string): string {
  return `${userId}@users.alnabiy.local`;
}

export function resolveAuthEmail(user: IdentityLike): string {
  const direct = readString(user.email);
  if (direct) return direct.toLowerCase();

  const meta = user.user_metadata || {};
  const fromMeta = readString(meta.email);
  if (fromMeta) return fromMeta.toLowerCase();

  for (const ident of user.identities || []) {
    const fromIdentity = readString(identityData(ident).email);
    if (fromIdentity) return fromIdentity.toLowerCase();
  }

  return fallbackAuthEmail(user.id || "unknown");
}

export function resolveAuthName(user: IdentityLike): string | null {
  const meta = user.user_metadata || {};
  const full =
    readString(meta.full_name) ||
    readString(meta.name) ||
    [readString(meta.given_name), readString(meta.family_name)]
      .filter(Boolean)
      .join(" ");
  if (full) return full;

  for (const ident of user.identities || []) {
    const data = identityData(ident);
    const fromIdentity =
      readString(data.full_name) ||
      readString(data.name) ||
      [readString(data.given_name), readString(data.family_name)]
        .filter(Boolean)
        .join(" ");
    if (fromIdentity) return fromIdentity;
  }

  return null;
}

export function resolveAuthAvatar(user: IdentityLike): string | null {
  const meta = user.user_metadata || {};
  const fromMeta = readString(meta.avatar_url) || readString(meta.picture);
  if (fromMeta) return fromMeta;

  for (const ident of user.identities || []) {
    const data = identityData(ident);
    const fromIdentity = readString(data.avatar_url) || readString(data.picture);
    if (fromIdentity) return fromIdentity;
  }

  return null;
}

export function extractSupabaseIdentity(
  user: IdentityLike | null | undefined
): AuthIdentity | null {
  if (!user?.id) return null;
  return {
    id: user.id,
    email: resolveAuthEmail(user),
    name: resolveAuthName(user),
    avatarUrl: resolveAuthAvatar(user),
    authProvider: resolveAuthProvider(
      user as Pick<SupabaseUser, "app_metadata" | "identities">
    ),
  };
}
