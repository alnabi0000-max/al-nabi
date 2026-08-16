import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { DEMO_STARTING_CREDITS } from "@/lib/credits";
import type { AuthProvider } from "@prisma/client";

export interface AuthIdentity {
  id: string; // Supabase auth.users UUID
  email: string;
  name?: string | null;
  authProvider?: AuthProvider;
  /** Skip the `lastLoginAt` write for background syncs that are not sign-ins. */
  touchLogin?: boolean;
}

/**
 * Supabase Auth → Prisma User sync (Phase 1).
 * Birinchi login: SIGNUP_GRANT + CoinLedger yozuvi.
 */
export async function ensurePrismaUser(identity: AuthIdentity) {
  const email = identity.email.toLowerCase();
  const provider = identity.authProvider;
  const touchLogin = identity.touchLogin !== false;

  const existing = await prisma.user.findUnique({
    where: { id: identity.id },
  });

  if (existing) {
    const emailChanged = existing.email !== email;
    const providerChanged = Boolean(provider) && existing.authProvider !== provider;
    if (!emailChanged && !providerChanged && !touchLogin) return existing;

    return prisma.user.update({
      where: { id: identity.id },
      data: {
        ...(emailChanged ? { email, name: identity.name ?? existing.name } : {}),
        ...(providerChanged ? { authProvider: provider } : {}),
        ...(touchLogin ? { lastLoginAt: new Date() } : {}),
      },
    });
  }

  const referralCode =
    "ALNABIY-" + randomBytes(3).toString("hex").toUpperCase();
  const grant = DEMO_STARTING_CREDITS;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        id: identity.id,
        email,
        name: identity.name ?? null,
        coins: grant,
        plan: "FREE",
        role: "USER",
        authProvider: provider ?? "MAGIC_LINK",
        lastLoginAt: touchLogin ? new Date() : null,
        referralCode,
        alnabiyKey: "sb_" + randomBytes(12).toString("hex"),
      },
    });

    if (grant > 0) {
      await tx.coinLedger.create({
        data: {
          userId: user.id,
          delta: grant,
          type: "SIGNUP_GRANT",
          reason: "signup:initial_grant",
          balanceAfter: grant,
        },
      });
    }

    return user;
  });
}
