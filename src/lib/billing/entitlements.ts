import {
  BillingProvider,
  BillingSubscriptionStatus,
  EntitlementSource,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const GENERATION_ENTITLEMENT = "generation.access";

export type PublicEntitlement = {
  code: string;
  source: EntitlementSource;
  startsAt: string;
  endsAt: string | null;
};

export type GenerationEntitlementResult =
  | { allowed: true; source: "free_usage" | "entitlement"; entitlement?: PublicEntitlement }
  | { allowed: false; code: "ENTITLEMENT_REQUIRED" };

function freeUsageEnabled(): boolean {
  /*
   * A durable User row still controls this default. Operators can require a
   * verified active entitlement without changing frontend code, while existing
   * configured free usage remains available by default.
   */
  return process.env.ALLOW_FREE_GENERATIONS !== "0";
}

export async function getCurrentEntitlements(
  userId: string
): Promise<PublicEntitlement[]> {
  const now = new Date();
  const rows = await prisma.entitlement.findMany({
    where: {
      userId,
      startsAt: { lte: now },
      revokedAt: null,
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      code: true,
      source: true,
      startsAt: true,
      endsAt: true,
    },
  });
  return rows.map((row) => ({
    code: row.code,
    source: row.source,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
  }));
}

export async function assertGenerationEntitlement(
  userId: string
): Promise<GenerationEntitlementResult> {
  const entitlements = await getCurrentEntitlements(userId);
  const generation = entitlements.find(
    (entitlement) => entitlement.code === GENERATION_ENTITLEMENT
  );
  if (generation) {
    return { allowed: true, source: "entitlement", entitlement: generation };
  }

  if (freeUsageEnabled()) {
    return { allowed: true, source: "free_usage" };
  }

  return { allowed: false, code: "ENTITLEMENT_REQUIRED" };
}

function toSubscriptionStatus(
  value: string
): BillingSubscriptionStatus {
  switch (value) {
    case "active":
      return BillingSubscriptionStatus.ACTIVE;
    case "trialing":
      return BillingSubscriptionStatus.TRIALING;
    case "past_due":
      return BillingSubscriptionStatus.PAST_DUE;
    case "canceled":
      return BillingSubscriptionStatus.CANCELED;
    case "unpaid":
      return BillingSubscriptionStatus.UNPAID;
    default:
      return BillingSubscriptionStatus.INCOMPLETE;
  }
}

/**
 * Normalize a verified provider subscription into durable subscription and
 * entitlement records. Only billing webhook handling calls this function.
 */
export async function syncStripeSubscription(input: {
  userId: string;
  customerId: string;
  subscriptionId: string;
  planCode: string;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}) {
  const status = toSubscriptionStatus(input.status);
  const active =
    status === BillingSubscriptionStatus.ACTIVE ||
    status === BillingSubscriptionStatus.TRIALING;

  return prisma.$transaction(async (tx) => {
    const subscription = await tx.billingSubscription.upsert({
      where: {
        provider_providerSubscriptionId: {
          provider: BillingProvider.STRIPE,
          providerSubscriptionId: input.subscriptionId,
        },
      },
      create: {
        userId: input.userId,
        provider: BillingProvider.STRIPE,
        providerCustomerId: input.customerId,
        providerSubscriptionId: input.subscriptionId,
        status,
        planCode: input.planCode,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      },
      update: {
        userId: input.userId,
        providerCustomerId: input.customerId,
        status,
        planCode: input.planCode,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      },
    });

    const entitlement = await tx.entitlement.upsert({
      where: {
        userId_code_source_sourceReference: {
          userId: input.userId,
          code: GENERATION_ENTITLEMENT,
          source: EntitlementSource.SUBSCRIPTION,
          sourceReference: input.subscriptionId,
        },
      },
      create: {
        userId: input.userId,
        code: GENERATION_ENTITLEMENT,
        source: EntitlementSource.SUBSCRIPTION,
        sourceReference: input.subscriptionId,
        subscriptionId: subscription.id,
        startsAt: new Date(),
        endsAt: active ? input.currentPeriodEnd : new Date(),
        revokedAt: active ? null : new Date(),
      },
      update: {
        subscriptionId: subscription.id,
        endsAt: active ? input.currentPeriodEnd : new Date(),
        revokedAt: active ? null : new Date(),
      },
    });

    return { subscription, entitlement };
  });
}
