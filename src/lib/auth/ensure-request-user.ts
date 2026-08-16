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
import type { User } from "@prisma/client";

const DEV_GUEST_EMAIL = "dev@alnabiy.local";

export type LedgerUser = Pick<
  User,
  "id" | "email" | "alnabiyKey" | "coins" | "referralCode" | "status"
>;

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
  return {
    id: u.id,
    email: u.email,
    alnabiyKey: u.alnabiyKey,
    coins: u.coins,
    referralCode: u.referralCode,
    status: u.status,
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

async function getSupabaseSessionLedgerUser(): Promise<LedgerUser | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    if (!supabase) return null;

    const { data, error } = await supabase.auth.getUser();
    const identity = data.user;
    if (error || !identity?.id || !identity.email) return null;

    const { onboardNewUser } = await import("@/lib/auth/onboarding");
    const { user } = await onboardNewUser(
      {
        id: identity.id,
        email: identity.email,
        name: identity.user_metadata?.full_name as string | undefined,
      },
      { sendEmail: false, source: "ledger_request" }
    );

    if (user.status === "BANNED") return null;
    return asLedger(user);
  } catch {
    // Do not downgrade a failed Supabase/Prisma lookup to local storage.
    return null;
  }
}

/**
 * Request session → ledger account.
 *
 * In Supabase mode (including all production deployments), only the
 * authenticated Supabase session is accepted. Legacy Alnabiy keys and local
 * storage remain available solely for local development.
 */
export async function ensureRequestLedgerUser(opts?: {
  alnabiyKey?: string | null;
  allowGuest?: boolean;
}): Promise<{ user: LedgerUser; guestCreated: boolean } | null> {
  const mode = getAuthMode();
  if (mode === "supabase") {
    const user = await getSupabaseSessionLedgerUser();
    return user ? { user, guestCreated: false } : null;
  }

  const key = opts?.alnabiyKey?.trim() || null;

  if (key) {
    const byKey = await resolveUserByKey(key);
    if (byKey) return { user: asLedger(byKey), guestCreated: false };

    const local = findUserByKey(key);
    if (local) {
      const db = await syncLocalUserToPrisma(local);
      if (db) return { user: asLedger(db), guestCreated: false };
      return { user: asLedger(local), guestCreated: false };
    }
  }

  try {
    const sessionUser = await getLocalSessionUser();
    if (sessionUser) {
      return { user: asLedger(sessionUser as User | LocalUser), guestCreated: false };
    }
  } catch {
    /* no cookie */
  }

  const allowGuest = opts?.allowGuest !== false && isSoftAuthEnabled();
  if (!allowGuest) return null;

  const guest = await ensureDevGuestUser();
  return { user: guest, guestCreated: true };
}
