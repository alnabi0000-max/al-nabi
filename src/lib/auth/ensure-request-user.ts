import { getAuthMode, isSupabaseConfigured } from "@/lib/auth/config";
import {
  findUserByEmail,
  findUserByKey,
  upsertLocalUser,
  type LocalUser,
} from "@/lib/auth/local-store";
import { getLocalSessionUser } from "@/lib/auth/session";
import { syncLocalUserToPrisma } from "@/lib/auth/sync-local";
import { resolveUserByKey } from "@/lib/assets";
import { getBearerIdentity, readRequestBearerToken, type HeaderSource } from "@/lib/auth/bearer";
import { resolveAuthProvider } from "@/lib/auth/providers";
import { DEV_GUEST_EMAIL } from "@/lib/auth/guest";
import type { User } from "@prisma/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export type LedgerUser = Pick<
  User,
  | "id"
  | "email"
  | "alnabiyKey"
  | "coins"
  | "referralCode"
  | "status"
  | "role"
  | "authProvider"
  | "createdAt"
>;

/** How the current request proved its identity. */
export type CredentialSource = "cookie" | "bearer" | "local" | "guest";

/** Local / development-only guest support. Never enable this for Supabase. */
export function isSoftAuthEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (getAuthMode() !== "local") return false;

  if (process.env.NEXT_PUBLIC_ALNABIY_MODE === "development") return true;
  if (process.env.ALNABIY_DEV_AUTH_BYPASS === "1") return true;
  if (!isSupabaseConfigured()) {
    return true;
  }
  return false;
}

function asLedger(u: User | LocalUser): LedgerUser {
  const isDbUser = "role" in u;
  return {
    id: u.id,
    email: u.email,
    alnabiyKey: u.alnabiyKey,
    coins: u.coins,
    referralCode: u.referralCode,
    status: u.status,
    role: isDbUser ? u.role : "USER",
    authProvider: isDbUser ? u.authProvider : "LOCAL",
    createdAt: u.createdAt instanceof Date ? u.createdAt : new Date(u.createdAt),
  };
}

/** Dev guest — barqaror email, Prisma + local store */
export async function ensureDevGuestUser(): Promise<LedgerUser> {
  let local =
    findUserByEmail(DEV_GUEST_EMAIL) ||
    upsertLocalUser({
      email: DEV_GUEST_EMAIL,
      password: "alnabiy-dev-guest",
    });

  const db = await syncLocalUserToPrisma(local);
  if (db) return asLedger(db);
  return asLedger(local);
}

/** Already-onboarded users — one read, no lastLoginAt write. */
async function existingLedgerById(
  id: string,
  email?: string | null
): Promise<LedgerUser | null> {
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.status === "BANNED") return null;
  if (email && user.email.toLowerCase() !== email.toLowerCase()) return null;
  return asLedger(user);
}

/** Supabase identity → ledger account. Returns `null` for banned users. */
async function ledgerUserFromIdentity(
  identity: SupabaseUser,
  source: string
): Promise<LedgerUser | null> {
  if (!identity.id || !identity.email) return null;

  const existing = await existingLedgerById(identity.id, identity.email);
  if (existing) return existing;

  const { onboardNewUser } = await import("@/lib/auth/onboarding");
  const { user } = await onboardNewUser(
    {
      id: identity.id,
      email: identity.email,
      name:
        (identity.user_metadata?.full_name as string | undefined) ||
        (identity.user_metadata?.name as string | undefined) ||
        null,
      authProvider: resolveAuthProvider(identity),
      touchLogin: false,
    },
    { sendEmail: false, source }
  );

  if (user.status === "BANNED") return null;
  return asLedger(user);
}

async function getSupabaseCookieLedgerUser(): Promise<LedgerUser | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    if (!supabase) return null;

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;

    return await ledgerUserFromIdentity(data.user, "ledger_request");
  } catch {
    // Do not downgrade a failed Supabase/Prisma lookup to local storage.
    return null;
  }
}

async function getBearerLedgerUser(token: string): Promise<LedgerUser | null> {
  try {
    const identity = await getBearerIdentity(token);
    if (!identity) return null;
    return await ledgerUserFromIdentity(identity, "ledger_request_bearer");
  } catch {
    return null;
  }
}

/**
 * Request session → ledger account.
 *
 * In Supabase mode (including all production deployments) only an
 * authenticated Supabase session is accepted, presented either as HTTP-only
 * cookies (web) or as a JWT bearer token (native iOS / Android). Legacy
 * Alnabiy keys and local storage remain available solely for local
 * development.
 */
export async function ensureRequestLedgerUser(opts?: {
  alnabiyKey?: string | null;
  allowGuest?: boolean;
  /** Request (or headers) to read the `Authorization` header from. */
  request?: HeaderSource;
}): Promise<{
  user: LedgerUser;
  guestCreated: boolean;
  source: CredentialSource;
} | null> {
  const mode = getAuthMode();
  if (mode === "supabase") {
    const token = await readRequestBearerToken(opts?.request);
    if (token) {
      const bearerUser = await getBearerLedgerUser(token);
      // A presented bearer token is an explicit identity claim — never fall
      // back to cookies when it fails to verify.
      return bearerUser
        ? { user: bearerUser, guestCreated: false, source: "bearer" }
        : null;
    }

    const user = await getSupabaseCookieLedgerUser();
    return user ? { user, guestCreated: false, source: "cookie" } : null;
  }

  const key = opts?.alnabiyKey?.trim() || null;

  if (key) {
    const byKey = await resolveUserByKey(key);
    if (byKey) {
      return { user: asLedger(byKey), guestCreated: false, source: "local" };
    }

    const local = findUserByKey(key);
    if (local) {
      const db = await syncLocalUserToPrisma(local);
      return {
        user: asLedger(db || local),
        guestCreated: false,
        source: "local",
      };
    }
  }

  try {
    const sessionUser = await getLocalSessionUser();
    if (sessionUser) {
      return {
        user: asLedger(sessionUser as User | LocalUser),
        guestCreated: false,
        source: "local",
      };
    }
  } catch {
    /* no cookie */
  }

  const allowGuest = opts?.allowGuest !== false && isSoftAuthEnabled();
  if (!allowGuest) return null;

  const guest = await ensureDevGuestUser();
  return { user: guest, guestCreated: true, source: "guest" };
}
