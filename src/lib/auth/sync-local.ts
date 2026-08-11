/**
 * Local auth (local-users.json) → Prisma User sync
 * Generate / ledger FK uchun majburiy.
 */

import { prisma } from "@/lib/prisma";
import type { LocalUser } from "@/lib/auth/local-store";
import type { AccountStatus, User } from "@prisma/client";
import { updateLocalCoins } from "@/lib/auth/local-store";

function asStatus(s: LocalUser["status"]): AccountStatus {
  if (s === "BANNED") return "BANNED";
  if (s === "WARNING") return "WARNING";
  return "ACTIVE";
}

/**
 * LocalUser ni Prisma `User` ga yozadi.
 * Mavjud bo‘lsa: email / key / status yangilanadi (coins Prisma manba).
 * Yangi bo‘lsa: local coins + SIGNUP_GRANT ledger.
 */
export async function syncLocalUserToPrisma(
  local: LocalUser
): Promise<User | null> {
  try {
    const existing = await prisma.user.findUnique({
      where: { id: local.id },
    });

    if (existing) {
      const updated = await prisma.user.update({
        where: { id: local.id },
        data: {
          email: local.email.toLowerCase(),
          alnabiyKey: local.alnabiyKey,
          status: asStatus(local.status),
          referralCode: existing.referralCode || local.referralCode,
        },
      });
      /* UI soft-store ni ledger bilan sinxron */
      try {
        updateLocalCoins(local.id, updated.coins);
      } catch {
        /* ignore */
      }
      return updated;
    }

    /* Email boshqa id bilan bo‘lsa — shu yozuvni qayta ishlatamiz.
     * Faqat kalit hali yo'q yoki mos bo'lsa bog'laymiz — aks holda
     * boshqa (masalan Supabase) hisobning kaliti tasodifan ustidan
     * yozilib, akkaunt egallab olinishi mumkin. */
    const byEmail = await prisma.user.findUnique({
      where: { email: local.email.toLowerCase() },
    });
    if (byEmail) {
      const canBindKey =
        !byEmail.alnabiyKey || byEmail.alnabiyKey === local.alnabiyKey;
      const updated = await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          alnabiyKey: canBindKey ? local.alnabiyKey : byEmail.alnabiyKey,
          status: asStatus(local.status),
        },
      });
      try {
        updateLocalCoins(local.id, updated.coins);
      } catch {
        /* ignore */
      }
      return updated;
    }

    const grant = Math.max(0, local.coins);
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: local.id,
          email: local.email.toLowerCase(),
          coins: grant,
          plan: "FREE",
          referralCode: local.referralCode,
          alnabiyKey: local.alnabiyKey,
          status: asStatus(local.status),
        },
      });

      if (grant > 0) {
        await tx.coinLedger.create({
          data: {
            userId: user.id,
            delta: grant,
            type: "SIGNUP_GRANT",
            reason: "local_auth:sync",
            balanceAfter: grant,
          },
        });
      }

      return user;
    });
  } catch (e) {
    console.warn(
      "[Alnabiy] syncLocalUserToPrisma failed",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}
