/**
 * Request → ledger User (local session / key / dev guest).
 */

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

/** Local / development — avtomatik guest session ruxsat */
export function isSoftAuthEnabled(): boolean {
  if (process.env.AUTH_MODE?.toLowerCase() === "local") return true;
  if (process.env.NEXT_PUBLIC_ALNABIY_MODE === "development") return true;
  if (process.env.ALNABIY_DEV_AUTH_BYPASS === "1") return true;
  if (process.env.NODE_ENV !== "production" && !isSupabaseConfigured()) {
    return true;
  }
  return getAuthMode() === "local";
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

/**
 * Kalit / cookie / (soft) guest → ledger account.
 */
export async function ensureRequestLedgerUser(opts?: {
  alnabiyKey?: string | null;
  allowGuest?: boolean;
}): Promise<{ user: LedgerUser; guestCreated: boolean } | null> {
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

  const allowGuest =
    opts?.allowGuest !== false && isSoftAuthEnabled();
  if (!allowGuest) return null;

  const guest = await ensureDevGuestUser();
  return { user: guest, guestCreated: true };
}
