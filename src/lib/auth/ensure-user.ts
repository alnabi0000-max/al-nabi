import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEMO_STARTING_CREDITS } from "@/lib/credits";
import type { AuthIdentity } from "@/lib/auth/identity";

export type { AuthIdentity };

export class EmailAlreadyRegisteredError extends Error {
  readonly code = "EMAIL_ALREADY_REGISTERED" as const;

  constructor(public readonly email: string) {
    super("This email is already registered with another sign-in method");
    this.name = "EmailAlreadyRegisteredError";
  }
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
    const nameChanged = Boolean(identity.name) && !existing.name;
    const nextAvatar = identity.avatarUrl?.trim() || null;
    const avatarChanged = Boolean(nextAvatar) && existing.avatarUrl !== nextAvatar;
    if (
      !emailChanged &&
      !providerChanged &&
      !nameChanged &&
      !avatarChanged &&
      !touchLogin
    ) {
      return existing;
    }

    return prisma.user.update({
      where: { id: identity.id },
      data: {
        ...(emailChanged ? { email } : {}),
        ...(nameChanged ? { name: identity.name } : {}),
        ...(avatarChanged ? { avatarUrl: nextAvatar } : {}),
        ...(providerChanged ? { authProvider: provider } : {}),
        ...(touchLogin ? { lastLoginAt: new Date() } : {}),
      },
    });
  }

  const referralCode =
    "ALNABIY-" + randomBytes(3).toString("hex").toUpperCase();
  const grant = DEMO_STARTING_CREDITS;

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: identity.id,
          email,
          name: identity.name ?? null,
          avatarUrl: identity.avatarUrl?.trim() || null,
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
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await prisma.user.findUnique({
        where: { id: identity.id },
      });
      if (raced) return raced;

      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail && byEmail.id !== identity.id) {
        throw new EmailAlreadyRegisteredError(email);
      }
    }
    throw error;
  }
}
