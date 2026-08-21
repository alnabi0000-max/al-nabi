import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class ProjectSpendCapError extends Error {
  constructor() {
    super("PROJECT_SPEND_CAP");
    this.name = "ProjectSpendCapError";
  }
}

type ProjectTx = Prisma.TransactionClient;

/**
 * Atomically reserve a project's displayed estimate before a job is queued.
 * `spent_nc + reserved_nc` is the authoritative cap check, so concurrent
 * enqueue requests cannot overbook the project budget.
 */
export async function reserveProjectSpend(
  tx: ProjectTx,
  input: { projectId: string; userId: string; credits: number }
): Promise<void> {
  const credits = Math.max(0, Math.round(input.credits));
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    UPDATE "projects"
    SET "reserved_nc" = "reserved_nc" + ${credits},
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${input.projectId}
      AND "user_id" = ${input.userId}::uuid
      AND "status" <> 'ARCHIVED'::"ProjectStatus"
      AND (
        "spend_cap_nc" IS NULL
        OR "spent_nc" + "reserved_nc" + ${credits} <= "spend_cap_nc"
      )
    RETURNING "id"
  `);

  if (rows.length !== 1) throw new ProjectSpendCapError();
}

/**
 * Called inside the same transaction as the user ledger debit. It moves the
 * one reservation tied to this generation into project spend exactly once.
 */
export async function settleProjectSpend(
  tx: ProjectTx,
  input: { generationId: string; credits: number }
): Promise<void> {
  const generation = await tx.generation.findUnique({
    where: { id: input.generationId },
    select: {
      projectId: true,
      reservedCredits: true,
      projectChargeSettled: true,
    },
  });

  if (!generation || generation.projectChargeSettled) return;
  if (!generation.projectId) {
    await tx.generation.update({
      where: { id: input.generationId },
      data: { creditsCost: Math.max(0, input.credits) },
    });
    return;
  }

  const reserved = Math.max(0, generation.reservedCredits);
  const changed = await tx.project.updateMany({
    where: {
      id: generation.projectId,
      reservedNc: { gte: reserved },
    },
    data: {
      reservedNc: { decrement: reserved },
      spentNc: { increment: Math.max(0, input.credits) },
    },
  });
  if (changed.count !== 1) {
    throw new Error("PROJECT_SPEND_RESERVATION_MISSING");
  }

  await tx.generation.update({
    where: { id: input.generationId },
    data: {
      creditsCost: Math.max(0, input.credits),
      reservedCredits: 0,
      projectChargeSettled: true,
    },
  });
  await tx.renderVersion.updateMany({
    where: { generationId: input.generationId },
    data: {
      status: "RENDERING",
      creditsCost: Math.max(0, input.credits),
    },
  });
}

/** Release an uncharged reservation when enqueueing or generation fails. */
export async function releaseProjectReservation(
  generationId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const generation = await tx.generation.findUnique({
      where: { id: generationId },
      select: { projectId: true, reservedCredits: true },
    });
    if (!generation) return;

    if (generation.projectId && generation.reservedCredits > 0) {
      await tx.project.updateMany({
        where: {
          id: generation.projectId,
          reservedNc: { gte: generation.reservedCredits },
        },
        data: { reservedNc: { decrement: generation.reservedCredits } },
      });
    }

    if (generation.reservedCredits > 0) {
      await tx.generation.update({
        where: { id: generationId },
        data: { reservedCredits: 0 },
      });
    }
  });
}

/**
 * Moves charged project spend back out after the ledger refund. The persistent
 * flags make retries safe even if a worker exits between refunding and this
 * reconciliation.
 */
export async function settleProjectRefund(generationId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const generation = await tx.generation.findUnique({
      where: { id: generationId },
      select: {
        projectId: true,
        creditsCost: true,
        projectChargeSettled: true,
        projectRefundSettled: true,
      },
    });
    if (
      !generation?.projectId ||
      !generation.projectChargeSettled ||
      generation.projectRefundSettled ||
      generation.creditsCost <= 0
    ) {
      return;
    }

    const changed = await tx.project.updateMany({
      where: {
        id: generation.projectId,
        spentNc: { gte: generation.creditsCost },
      },
      data: { spentNc: { decrement: generation.creditsCost } },
    });
    if (changed.count !== 1) {
      throw new Error("PROJECT_SPEND_REFUND_MISSING");
    }

    await tx.generation.update({
      where: { id: generationId },
      data: { projectRefundSettled: true },
    });
  });
}
