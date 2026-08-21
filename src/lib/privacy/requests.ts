import {
  PrivacyRequestStatus,
  PrivacyRequestType,
  type PrivacyRequest,
} from "@prisma/client";
import { deleteStoredObject } from "@/lib/storage/object-storage";
import { prisma } from "@/lib/prisma";

const ERASURE_CONFIRMATION = "ERASE MY ACCOUNT";

export type PrivacyRequestView = {
  id: string;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  holdReason: string | null;
  errorCode: string | null;
  createdAt: string;
  confirmationAt: string | null;
  completedAt: string | null;
};

function toView(row: PrivacyRequest): PrivacyRequestView {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    holdReason: row.holdReason,
    errorCode: row.errorCode,
    createdAt: row.createdAt.toISOString(),
    confirmationAt: row.confirmationAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export function isValidErasureConfirmation(value: string): boolean {
  return value.trim().toUpperCase() === ERASURE_CONFIRMATION;
}

export async function listPrivacyRequests(
  userId: string
): Promise<PrivacyRequestView[]> {
  const rows = await prisma.privacyRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  return rows.map(toView);
}

async function erasureHoldReason(userId: string): Promise<string | null> {
  if (process.env.PRIVACY_ERASURE_HOLD === "1") {
    return "OPERATOR_RETENTION_HOLD";
  }

  const retentionDays = Number.parseInt(
    process.env.PRIVACY_BILLING_RETENTION_DAYS || "0",
    10
  );
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return null;

  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const recentPaidPurchase = await prisma.purchase.findFirst({
    where: {
      userId,
      status: "PAID",
      createdAt: { gte: cutoff },
    },
    select: { id: true },
  });
  return recentPaidPurchase ? "BILLING_RETENTION_HOLD" : null;
}

export async function createErasureRequest(input: {
  userId: string;
  confirmation: string;
}): Promise<PrivacyRequestView> {
  if (!isValidErasureConfirmation(input.confirmation)) {
    throw new ErasureConfirmationError();
  }

  const existing = await prisma.privacyRequest.findFirst({
    where: {
      userId: input.userId,
      type: PrivacyRequestType.ACCOUNT_ERASURE,
      status: {
        in: [
          PrivacyRequestStatus.PENDING_CONFIRMATION,
          PrivacyRequestStatus.REQUESTED,
          PrivacyRequestStatus.HELD,
          PrivacyRequestStatus.PROCESSING,
        ],
      },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return toView(existing);

  const holdReason = await erasureHoldReason(input.userId);
  const row = await prisma.privacyRequest.create({
    data: {
      userId: input.userId,
      type: PrivacyRequestType.ACCOUNT_ERASURE,
      status: holdReason
        ? PrivacyRequestStatus.HELD
        : PrivacyRequestStatus.REQUESTED,
      confirmationAt: new Date(),
      holdReason,
      scope: {
        account: "account_profile_and_user_content",
        media: "private_owned_objects",
      },
    },
  });
  return toView(row);
}

export async function createDataExport(input: {
  userId: string;
}): Promise<{ request: PrivacyRequestView; exportData: Record<string, unknown> }> {
  const request = await prisma.privacyRequest.create({
    data: {
      userId: input.userId,
      type: PrivacyRequestType.DATA_EXPORT,
      status: PrivacyRequestStatus.PROCESSING,
      scope: {
        media: "metadata_only_no_signed_urls",
        records: "account_consent_projects_generations_billing",
      },
    },
  });

  try {
    const exportData = await buildScopedExport(input.userId);
    const completed = await prisma.privacyRequest.update({
      where: { id: request.id },
      data: {
        status: PrivacyRequestStatus.COMPLETED,
        exportedAt: new Date(),
        completedAt: new Date(),
      },
    });
    return { request: toView(completed), exportData };
  } catch (error) {
    await prisma.privacyRequest
      .update({
        where: { id: request.id },
        data: {
          status: PrivacyRequestStatus.FAILED,
          errorCode: "EXPORT_BUILD_FAILED",
          failedAt: new Date(),
        },
      })
      .catch(() => undefined);
    throw error;
  }
}

/**
 * Direct, authenticated response payload only. No persistent signed URL or
 * object key is ever included, so the export cannot become an asset-delivery
 * capability if it is later copied or stored.
 */
async function buildScopedExport(userId: string): Promise<Record<string, unknown>> {
  const [user, consents, projects, generations, purchases, ledger, safety] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          locale: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.userConsent.findMany({
        where: { userId },
        select: {
          document: true,
          documentVersion: true,
          action: true,
          source: true,
          recordedAt: true,
        },
        orderBy: { recordedAt: "asc" },
      }),
      prisma.project.findMany({
        where: { userId },
        select: {
          id: true,
          title: true,
          brief: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.generation.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          status: true,
          prompt: true,
          script: true,
          style: true,
          quality: true,
          durationSec: true,
          creditsCost: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.purchase.findMany({
        where: { userId },
        select: {
          id: true,
          packId: true,
          coins: true,
          bonus: true,
          amountCents: true,
          currency: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.coinLedger.findMany({
        where: { userId },
        select: {
          id: true,
          delta: true,
          type: true,
          reason: true,
          balanceAfter: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.safetyAudit.findMany({
        where: { userId },
        select: {
          surface: true,
          policyVersion: true,
          outcome: true,
          referenceMedia: true,
          evaluator: true,
          coverage: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  return {
    schemaVersion: "2026-08-20",
    generatedAt: new Date().toISOString(),
    profile: user,
    consents,
    projects,
    generations,
    purchases,
    ledger,
    safetyAudits: safety,
    mediaNotice:
      "Media files and signed object URLs are intentionally excluded. Request individual private downloads while your account remains active.",
  };
}

async function ownedObjectKeys(userId: string): Promise<string[]> {
  const [generations, assets, renders, exports] = await Promise.all([
    prisma.generation.findMany({
      where: { userId },
      select: { r2Key: true },
    }),
    prisma.projectAsset.findMany({
      where: { userId },
      select: { r2Key: true },
    }),
    prisma.renderVersion.findMany({
      where: { project: { userId } },
      select: { outputR2Key: true },
    }),
    prisma.projectExport.findMany({
      where: { userId },
      select: { outputR2Key: true },
    }),
  ]);

  return [
    ...generations.map((row) => row.r2Key),
    ...assets.map((row) => row.r2Key),
    ...renders.map((row) => row.outputR2Key),
    ...exports.map((row) => row.outputR2Key),
  ].filter((key): key is string => Boolean(key));
}

/**
 * Performs actual erasure work only after a confirmed, eligible request. Object
 * deletion happens through deleteStoredObject before database content is
 * removed, allowing a failed deletion to remain visible and retryable.
 */
export async function processErasureRequest(input: {
  requestId: string;
  userId: string;
}): Promise<PrivacyRequestView> {
  const request = await prisma.privacyRequest.findFirst({
    where: {
      id: input.requestId,
      userId: input.userId,
      type: PrivacyRequestType.ACCOUNT_ERASURE,
    },
  });
  if (!request) throw new PrivacyRequestNotFoundError();
  if (
    request.status === PrivacyRequestStatus.COMPLETED ||
    request.status === PrivacyRequestStatus.HELD ||
    request.status === PrivacyRequestStatus.FAILED
  ) {
    return toView(request);
  }
  if (request.status !== PrivacyRequestStatus.REQUESTED) {
    return toView(request);
  }

  const currentHold = await erasureHoldReason(input.userId);
  if (currentHold) {
    const held = await prisma.privacyRequest.update({
      where: { id: request.id },
      data: {
        status: PrivacyRequestStatus.HELD,
        holdReason: currentHold,
      },
    });
    return toView(held);
  }

  const claimed = await prisma.privacyRequest.updateMany({
    where: {
      id: request.id,
      status: PrivacyRequestStatus.REQUESTED,
    },
    data: { status: PrivacyRequestStatus.PROCESSING },
  });
  if (claimed.count === 0) {
    const current = await prisma.privacyRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    return toView(current);
  }

  try {
    const keys = [...new Set(await ownedObjectKeys(input.userId))];
    /*
     * Existing storage primitives only accept the private generated-object
     * namespace. An unexpected key is a failure, never an excuse to delete its
     * database marker while leaving private media behind.
     */
    if (keys.some((key) => !key.startsWith("generations/"))) {
      throw new Error("UNSUPPORTED_PRIVATE_OBJECT_KEY");
    }
    for (const key of keys) {
      await deleteStoredObject(key);
    }

    const account = await prisma.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { email: true },
    });
    const tombstone = `erased-${input.userId}@erased.invalid`;

    const completed = await prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId: input.userId } });
      await tx.projectAsset.deleteMany({ where: { userId: input.userId } });
      await tx.project.deleteMany({ where: { userId: input.userId } });
      await tx.generation.deleteMany({ where: { userId: input.userId } });
      await tx.producerInterestProfile.deleteMany({
        where: { userId: input.userId },
      });
      await tx.referral.deleteMany({ where: { referrerId: input.userId } });
      await tx.referral.updateMany({
        where: { inviteeEmail: account.email },
        data: { inviteeEmail: tombstone, inviteeId: null },
      });
      await tx.purchase.updateMany({
        where: { userId: input.userId },
        data: { regionToken: null },
      });
      await tx.user.update({
        where: { id: input.userId },
        data: {
          email: tombstone,
          name: null,
          avatarUrl: null,
          alnabiyKey: `ERASED-${input.userId}`,
          referralCode: `ERASED-${input.userId}`,
          stripeCustomerId: null,
          locale: "en",
          status: "BANNED",
        },
      });
      return tx.privacyRequest.update({
        where: { id: request.id },
        data: {
          status: PrivacyRequestStatus.COMPLETED,
          completedAt: new Date(),
          errorCode: null,
        },
      });
    });
    return toView(completed);
  } catch (error) {
    const errorCode =
      error instanceof Error && error.message === "UNSUPPORTED_PRIVATE_OBJECT_KEY"
        ? "UNSUPPORTED_PRIVATE_OBJECT_KEY"
        : "ERASURE_DELETE_FAILED";
    const failed = await prisma.privacyRequest.update({
      where: { id: request.id },
      data: {
        status: PrivacyRequestStatus.FAILED,
        errorCode,
        failedAt: new Date(),
      },
    });
    return toView(failed);
  }
}

export class ErasureConfirmationError extends Error {
  constructor() {
    super(`Type "${ERASURE_CONFIRMATION}" to confirm account erasure.`);
    this.name = "ErasureConfirmationError";
  }
}

export class PrivacyRequestNotFoundError extends Error {
  constructor() {
    super("Privacy request not found.");
    this.name = "PrivacyRequestNotFoundError";
  }
}
