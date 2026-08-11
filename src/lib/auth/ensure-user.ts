import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { DEMO_STARTING_CREDITS } from "@/lib/credits";

export interface AuthIdentity {
  id: string; // Supabase auth.users UUID
  email: string;
  name?: string | null;
}

/**
 * Supabase Auth → Prisma User sync (Phase 1).
 * Birinchi login: SIGNUP_GRANT + CoinLedger yozuvi.
 */
export async function ensurePrismaUser(identity: AuthIdentity) {
  const existing = await prisma.user.findUnique({
    where: { id: identity.id },
  });
  if (existing) {
    if (existing.email !== identity.email.toLowerCase()) {
      return prisma.user.update({
        where: { id: identity.id },
        data: {
          email: identity.email.toLowerCase(),
          name: identity.name ?? existing.name,
        },
      });
    }
    return existing;
  }

  const referralCode =
    "ALNABIY-" + randomBytes(3).toString("hex").toUpperCase();
  const grant = DEMO_STARTING_CREDITS;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        id: identity.id,
        email: identity.email.toLowerCase(),
        name: identity.name ?? null,
        coins: grant,
        plan: "FREE",
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
