import { createHash } from "crypto";
import {
  BillingProvider,
  BillingSubscriptionStatus,
  ReconciliationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Finding = {
  kind:
    | "PAID_PURCHASE_MISSING_LEDGER"
    | "ACTIVE_SUBSCRIPTION_MISSING_ENTITLEMENT"
    | "ENTITLEMENT_WITH_INACTIVE_SUBSCRIPTION"
    | "PROCESSED_BILLING_EVENT_UNLINKED"
    | "PROCESSING_BILLING_EVENT_STALE";
  subjectKey: string;
  userId: string | null;
  details: Record<string, string>;
};

const activeSubscriptionStatuses: BillingSubscriptionStatus[] = [
  BillingSubscriptionStatus.ACTIVE,
  BillingSubscriptionStatus.TRIALING,
];

function fingerprint(input: Finding): string {
  return createHash("sha256")
    .update(`${input.kind}:${input.subjectKey}`)
    .digest("hex");
}

async function recordFinding(finding: Finding): Promise<void> {
  const now = new Date();
  await prisma.billingReconciliation.upsert({
    where: { fingerprint: fingerprint(finding) },
    create: {
      provider: BillingProvider.STRIPE,
      fingerprint: fingerprint(finding),
      kind: finding.kind,
      subjectKey: finding.subjectKey,
      userId: finding.userId,
      status: ReconciliationStatus.OPEN,
      details: finding.details,
      firstSeenAt: now,
      lastSeenAt: now,
    },
    update: {
      userId: finding.userId,
      status: ReconciliationStatus.OPEN,
      details: finding.details,
      lastSeenAt: now,
      resolvedAt: null,
    },
  });
}

/**
 * Detects discrepancies only. It never creates a ledger entry, changes a
 * balance, alters subscription status, or grants/revokes an entitlement.
 */
export async function reconcileBillingRecords(input?: {
  limit?: number;
}): Promise<{
  checkedPurchases: number;
  checkedSubscriptions: number;
  checkedEntitlements: number;
  checkedWebhookEvents: number;
  findings: number;
}> {
  const take = Math.min(Math.max(input?.limit ?? 500, 1), 2_000);
  const now = new Date();
  const [purchases, subscriptions, entitlements, webhookEvents] = await Promise.all([
    prisma.purchase.findMany({
      where: { status: "PAID" },
      take,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        userId: true,
        ledgerEntries: {
          where: { type: "PURCHASE" },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.billingSubscription.findMany({
      where: {
        status: {
          in: [
            BillingSubscriptionStatus.ACTIVE,
            BillingSubscriptionStatus.TRIALING,
          ],
        },
      },
      take,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        userId: true,
        providerSubscriptionId: true,
        entitlements: {
          where: {
            revokedAt: null,
            startsAt: { lte: now },
            OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.entitlement.findMany({
      where: {
        source: "SUBSCRIPTION",
        revokedAt: null,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      take,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        userId: true,
        subscription: {
          select: { status: true },
        },
      },
    }),
    prisma.billingWebhookEvent.findMany({
      where: {
        status: { in: ["PROCESSED", "PROCESSING"] },
      },
      take,
      orderBy: { processedAt: "desc" },
      select: {
        id: true,
        status: true,
        userId: true,
        purchaseId: true,
        subscriptionId: true,
        updatedAt: true,
      },
    }),
  ]);

  const findings: Finding[] = [];
  for (const purchase of purchases) {
    if (purchase.ledgerEntries.length === 0) {
      findings.push({
        kind: "PAID_PURCHASE_MISSING_LEDGER",
        subjectKey: purchase.id,
        userId: purchase.userId,
        details: { purchaseId: purchase.id },
      });
    }
  }
  for (const subscription of subscriptions) {
    if (subscription.entitlements.length === 0) {
      findings.push({
        kind: "ACTIVE_SUBSCRIPTION_MISSING_ENTITLEMENT",
        subjectKey: subscription.providerSubscriptionId,
        userId: subscription.userId,
        details: { subscriptionId: subscription.id },
      });
    }
  }
  for (const entitlement of entitlements) {
    const subscription = entitlement.subscription;
    if (
      !subscription ||
      !activeSubscriptionStatuses.includes(subscription.status)
    ) {
      findings.push({
        kind: "ENTITLEMENT_WITH_INACTIVE_SUBSCRIPTION",
        subjectKey: entitlement.id,
        userId: entitlement.userId,
        details: { entitlementId: entitlement.id },
      });
    }
  }
  for (const event of webhookEvents) {
    if (
      event.status === "PROCESSING" &&
      event.updatedAt < new Date(now.getTime() - 5 * 60_000)
    ) {
      findings.push({
        kind: "PROCESSING_BILLING_EVENT_STALE",
        subjectKey: event.id,
        userId: event.userId,
        details: { billingWebhookEventId: event.id },
      });
    } else if (
      event.status === "PROCESSED" &&
      !event.purchaseId &&
      !event.subscriptionId
    ) {
      findings.push({
        kind: "PROCESSED_BILLING_EVENT_UNLINKED",
        subjectKey: event.id,
        userId: event.userId,
        details: { billingWebhookEventId: event.id },
      });
    }
  }

  await Promise.all(findings.map((finding) => recordFinding(finding)));
  return {
    checkedPurchases: purchases.length,
    checkedSubscriptions: subscriptions.length,
    checkedEntitlements: entitlements.length,
    checkedWebhookEvents: webhookEvents.length,
    findings: findings.length,
  };
}
