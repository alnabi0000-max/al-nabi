import { createHash } from "crypto";
import {
  BillingProvider,
  BillingWebhookStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type WebhookClaim =
  | { claimed: true; eventId: string }
  | { claimed: false; duplicate: boolean; inProgress: boolean; eventId: string };

export function billingPayloadDigest(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function processingTimeoutMs(): number {
  const configured = Number.parseInt(
    process.env.BILLING_WEBHOOK_PROCESSING_TIMEOUT_SEC || "300",
    10
  );
  return Math.min(Math.max(configured, 30), 3_600) * 1_000;
}

/**
 * Claims a verified provider event before it can affect purchases,
 * subscriptions, or entitlements. Signature verification must happen first.
 */
export async function claimBillingWebhookEvent(input: {
  provider: BillingProvider;
  providerEventId: string;
  eventType: string;
  providerObjectId?: string | null;
  rawPayload: string;
}): Promise<WebhookClaim> {
  try {
    const row = await prisma.billingWebhookEvent.create({
      data: {
        provider: input.provider,
        providerEventId: input.providerEventId,
        eventType: input.eventType,
        providerObjectId: input.providerObjectId || null,
        payloadDigest: billingPayloadDigest(input.rawPayload),
        status: BillingWebhookStatus.PROCESSING,
      },
    });
    return { claimed: true, eventId: row.id };
  } catch (error) {
    if ((error as { code?: string } | null)?.code !== "P2002") {
      throw error;
    }
  }

  const existing = await prisma.billingWebhookEvent.findUniqueOrThrow({
    where: {
      provider_providerEventId: {
        provider: input.provider,
        providerEventId: input.providerEventId,
      },
    },
    select: { id: true, status: true, updatedAt: true },
  });
  if (
    existing.status === BillingWebhookStatus.PROCESSED ||
    existing.status === BillingWebhookStatus.IGNORED
  ) {
    return {
      claimed: false,
      duplicate: true,
      inProgress: false,
      eventId: existing.id,
    };
  }
  if (existing.status === BillingWebhookStatus.PROCESSING) {
    /*
     * A crashed runtime must not pin an event in PROCESSING forever. Any
     * duplicate post-timeout is safe because downstream purchase and
     * entitlement writes have their own durable idempotency constraints.
     */
    const staleBefore = new Date(Date.now() - processingTimeoutMs());
    const reclaimed = await prisma.billingWebhookEvent.updateMany({
      where: {
        id: existing.id,
        status: BillingWebhookStatus.PROCESSING,
        updatedAt: { lt: staleBefore },
      },
      data: {
        status: BillingWebhookStatus.PROCESSING,
        errorCode: null,
      },
    });
    if (reclaimed.count === 1) {
      return { claimed: true, eventId: existing.id };
    }
    return {
      claimed: false,
      duplicate: false,
      inProgress: true,
      eventId: existing.id,
    };
  }

  const retry = await prisma.billingWebhookEvent.updateMany({
    where: {
      id: existing.id,
      status: BillingWebhookStatus.FAILED,
    },
    data: {
      status: BillingWebhookStatus.PROCESSING,
      errorCode: null,
      providerObjectId: input.providerObjectId || null,
      payloadDigest: billingPayloadDigest(input.rawPayload),
    },
  });
  return retry.count === 1
    ? { claimed: true, eventId: existing.id }
    : {
        claimed: false,
        duplicate: false,
        inProgress: true,
        eventId: existing.id,
      };
}

export async function completeBillingWebhookEvent(input: {
  eventId: string;
  userId?: string | null;
  purchaseId?: string | null;
  subscriptionId?: string | null;
  ignored?: boolean;
}) {
  await prisma.billingWebhookEvent.update({
    where: { id: input.eventId },
    data: {
      status: input.ignored
        ? BillingWebhookStatus.IGNORED
        : BillingWebhookStatus.PROCESSED,
      userId: input.userId || null,
      purchaseId: input.purchaseId || null,
      subscriptionId: input.subscriptionId || null,
      processedAt: new Date(),
      errorCode: null,
    },
  });
}

export async function failBillingWebhookEvent(input: {
  eventId: string;
  errorCode: string;
}) {
  await prisma.billingWebhookEvent.update({
    where: { id: input.eventId },
    data: {
      status: BillingWebhookStatus.FAILED,
      errorCode: input.errorCode.slice(0, 100),
    },
  });
}
