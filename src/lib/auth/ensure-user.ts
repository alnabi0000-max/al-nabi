import { randomBytes } from "crypto";
import { Prisma, type AuthProvider, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEMO_STARTING_CREDITS } from "@/lib/credits";

export interface AuthIdentity {
  id: string; // Supabase `auth.users.id` (UUID)
  email: string;
  name?: string | null;
  authProvider?: AuthProvider;
  /** Skip the `lastLoginAt` write for background syncs that are not sign-ins. */
  touchLogin?: boolean;
}

function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function uniqueTargetIncludes(error: unknown, field: string): boolean {
  if (!isUniqueConflict(error)) return false;
  const target = (error as Prisma.PrismaClientKnownRequestError).meta?.target;
  const names = Array.isArray(target)
    ? target.map(String)
    : typeof target === "string"
      ? [target]
      : [];
  if (!names.length) return true;
  const needle = field.toLowerCase();
  return names.some((name) => name.toLowerCase().includes(needle));
}

async function applyIdentityPatch(
  user: User,
  identity: AuthIdentity,
  email: string
): Promise<User> {
  const provider = identity.authProvider;
  const touchLogin = identity.touchLogin !== false;
  const emailChanged = user.email !== email;
  const providerChanged = Boolean(provider) && user.authProvider !== provider;
  if (!emailChanged && !providerChanged && !touchLogin) return user;

  try {
    return await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(emailChanged ? { email, name: identity.name ?? user.name } : {}),
        ...(providerChanged ? { authProvider: provider } : {}),
        ...(touchLogin ? { lastLoginAt: new Date() } : {}),
      },
    });
  } catch (error) {
    if (isUniqueConflict(error) && uniqueTargetIncludes(error, "email")) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail && byEmail.id !== user.id) {
        return adoptEmailAccount(byEmail, identity, email);
      }
    }
    throw error;
  }
}

/**
 * Move an existing Prisma row onto the canonical Supabase Auth UUID.
 * Local/guest or earlier email sign-ins often occupy `users.email` with a
 * different id; Google OAuth then fails with P2002 unless we rekey.
 */
async function adoptEmailAccount(
  from: User,
  identity: AuthIdentity,
  email: string
): Promise<User> {
  if (from.id === identity.id) {
    return applyIdentityPatch(from, identity, email);
  }

  const already = await prisma.user.findUnique({
    where: { id: identity.id },
  });
  if (already) {
    return applyIdentityPatch(already, identity, email);
  }

  const keep = {
    name: identity.name ?? from.name,
    coins: from.coins,
    plan: from.plan,
    role: from.role,
    status: from.status,
    locale: from.locale,
    avatarUrl: from.avatarUrl,
    referralCode: from.referralCode,
    alnabiyKey: from.alnabiyKey,
    stripeCustomerId: from.stripeCustomerId,
    referredBy: from.referredBy,
  };

  const compactId = from.id.replace(/-/g, "");
  const tempEmail = `replaced.${compactId}@users.alnabiy.local`;
  const tempKey = `old_${compactId.slice(0, 24)}`;
  const tempReferral = `OLD-${randomBytes(4).toString("hex").toUpperCase()}`;
  const provider = identity.authProvider ?? from.authProvider;
  const touchLogin = identity.touchLogin !== false;

  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: from.id },
      data: {
        email: tempEmail,
        alnabiyKey: tempKey,
        referralCode: tempReferral,
        stripeCustomerId: null,
      },
    });

    const created = await tx.user.create({
      data: {
        id: identity.id,
        email,
        name: keep.name,
        coins: keep.coins,
        plan: keep.plan,
        role: keep.role,
        status: keep.status,
        locale: keep.locale,
        avatarUrl: keep.avatarUrl,
        referralCode: keep.referralCode,
        alnabiyKey: keep.alnabiyKey,
        stripeCustomerId: keep.stripeCustomerId,
        referredBy: keep.referredBy,
        authProvider: provider,
        lastLoginAt: touchLogin ? new Date() : from.lastLoginAt,
      },
    });

    const fromId = from.id;
    const toId = created.id;

    await tx.coinLedger.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.generation.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.purchase.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.referral.updateMany({
      where: { referrerId: fromId },
      data: { referrerId: toId },
    });
    await tx.referral.updateMany({
      where: { inviteeId: fromId },
      data: { inviteeId: toId },
    });
    await tx.session.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.producerInterestProfile.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.project.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.projectAsset.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.projectExport.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.approval.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.userConsent.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.safetyAudit.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.privacyRequest.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.billingSubscription.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.entitlement.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.billingWebhookEvent.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.billingReconciliation.updateMany({
      where: { userId: fromId },
      data: { userId: toId },
    });
    await tx.adminSettings.updateMany({
      where: { updatedById: fromId },
      data: { updatedById: toId },
    });

    await tx.user.delete({ where: { id: fromId } });
    return created;
  });
}

async function createFreshUser(
  identity: AuthIdentity,
  email: string
): Promise<User> {
  const provider = identity.authProvider;
  const touchLogin = identity.touchLogin !== false;
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

/**
 * Supabase Auth → Prisma User sync (Phase 1).
 * First login: SIGNUP_GRANT + CoinLedger row.
 * Google OAuth is idempotent: races and email collisions are adopted onto
 * `auth.users.id`.
 */
export async function ensurePrismaUser(identity: AuthIdentity) {
  const email = identity.email.toLowerCase();

  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await prisma.user.findUnique({
      where: { id: identity.id },
    });
    if (existing) {
      return applyIdentityPatch(existing, identity, email);
    }

    const byEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (byEmail) {
      return adoptEmailAccount(byEmail, identity, email);
    }

    try {
      return await createFreshUser(identity, email);
    } catch (error) {
      if (isUniqueConflict(error) && attempt < 2) {
        continue;
      }
      throw error;
    }
  }

  const fallback = await prisma.user.findUnique({
    where: { id: identity.id },
  });
  if (fallback) return applyIdentityPatch(fallback, identity, email);
  throw new Error("ensurePrismaUser failed after retries");
}
