import type {
  AccountStatus,
  GenerationStatus,
  LedgerKind,
  PurchaseStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  centsToUsd,
  estimateApiOverheadUsd,
  netProfitUsd,
  resolveAnalyticsRange,
  type AnalyticsRangeKey,
  type AnalyticsWindow,
} from "@/lib/admin/analytics";

export const ADMIN_PAGE_SIZE = 40;

export class AdminOpsError extends Error {
  readonly code: string;
  constructor(message: string, code = "ADMIN_OPS") {
    super(message);
    this.name = "AdminOpsError";
    this.code = code;
  }
}

export type LedgerEntryRow = {
  id: string;
  createdAt: string;
  email: string;
  type: LedgerKind;
  delta: number;
  reason: string;
  balanceAfter: number;
};

export type PurchaseRow = {
  id: string;
  createdAt: string;
  email: string;
  packId: string;
  amountUsd: number;
  nc: number;
  status: PurchaseStatus;
};

export type AdminLedgerPayload = {
  range: AnalyticsWindow;
  summary: {
    incomeUsd: number;
    refundUsd: number;
    apiCostUsd: number;
    expenseUsd: number;
    netUsd: number;
    ncIn: number;
    ncOut: number;
    paidOrders: number;
    refundedOrders: number;
  };
  byKind: Array<{ type: LedgerKind; ncIn: number; ncOut: number }>;
  entries: LedgerEntryRow[];
  purchases: PurchaseRow[];
};

export type AdminUserRow = {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  coins: number;
  plan: string;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AdminUsersPayload = {
  users: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminJobRow = {
  id: string;
  createdAt: string;
  email: string;
  type: string;
  status: GenerationStatus;
  creditsCost: number;
  errorMessage: string | null;
};

export type AdminJobsPayload = {
  jobs: AdminJobRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function loadAdminLedger(opts: {
  range: AnalyticsRangeKey;
  from?: string;
  to?: string;
  now?: Date;
}): Promise<AdminLedgerPayload> {
  const bounds = resolveAnalyticsRange(opts.range, opts.now ?? new Date(), {
    from: opts.from,
    to: opts.to,
  });
  const createdAt = { gte: bounds.from, lt: bounds.to };

  const [purchases, entries, kindIn, kindOut, purchaseGroups] = await Promise.all([
    prisma.purchase.findMany({
      where: { createdAt },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: {
        id: true,
        createdAt: true,
        packId: true,
        amountCents: true,
        coins: true,
        bonus: true,
        status: true,
        user: { select: { email: true } },
      },
    }),
    prisma.coinLedger.findMany({
      where: { createdAt },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: {
        id: true,
        createdAt: true,
        type: true,
        delta: true,
        reason: true,
        balanceAfter: true,
        user: { select: { email: true } },
      },
    }),
    prisma.coinLedger.groupBy({
      by: ["type"],
      where: { createdAt, delta: { gt: 0 } },
      _sum: { delta: true },
    }),
    prisma.coinLedger.groupBy({
      by: ["type"],
      where: { createdAt, delta: { lt: 0 } },
      _sum: { delta: true },
    }),
    prisma.purchase.groupBy({
      by: ["status"],
      where: { createdAt },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
  ]);

  const paidGroup = purchaseGroups.find((row) => row.status === "PAID");
  const refundedGroup = purchaseGroups.find((row) => row.status === "REFUNDED");
  const incomeUsd = centsToUsd(paidGroup?._sum.amountCents ?? 0);
  const refundUsd = centsToUsd(refundedGroup?._sum.amountCents ?? 0);

  const kinds = new Set([
    ...kindIn.map((row) => row.type),
    ...kindOut.map((row) => row.type),
  ]);
  const byKind = [...kinds].map((type) => ({
    type,
    ncIn: kindIn.find((row) => row.type === type)?._sum.delta ?? 0,
    ncOut: Math.abs(kindOut.find((row) => row.type === type)?._sum.delta ?? 0),
  }));
  const ncIn = byKind.reduce((sum, row) => sum + row.ncIn, 0);
  const ncOut = byKind.reduce((sum, row) => sum + row.ncOut, 0);
  const apiCostUsd = estimateApiOverheadUsd(
    byKind.find((row) => row.type === "CHARGE")?.ncOut ?? ncOut
  );
  const expenseUsd = Math.round((apiCostUsd + refundUsd) * 100) / 100;

  return {
    range: {
      key: bounds.key,
      from: bounds.from.toISOString(),
      to: bounds.to.toISOString(),
      timezone: bounds.timezone,
    },
    summary: {
      incomeUsd,
      refundUsd,
      apiCostUsd,
      expenseUsd,
      netUsd: netProfitUsd(incomeUsd, expenseUsd),
      ncIn,
      ncOut,
      paidOrders: paidGroup?._count._all ?? 0,
      refundedOrders: refundedGroup?._count._all ?? 0,
    },
    byKind,
    entries: entries.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      email: row.user.email,
      type: row.type,
      delta: row.delta,
      reason: row.reason,
      balanceAfter: row.balanceAfter,
    })),
    purchases: purchases.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      email: row.user.email,
      packId: row.packId,
      amountUsd: centsToUsd(row.amountCents),
      nc: row.coins + row.bonus,
      status: row.status,
    })),
  };
}

export async function loadAdminUsers(opts: {
  q?: string;
  page?: number;
}): Promise<AdminUsersPayload> {
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.q?.trim();
  const where = q
    ? { email: { contains: q, mode: "insensitive" as const } }
    : {};

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        coins: true,
        plan: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
  ]);

  return {
    total,
    page,
    pageSize: ADMIN_PAGE_SIZE,
    users: rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      coins: row.coins,
      plan: row.plan,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    })),
  };
}

export async function loadAdminJobs(opts: {
  q?: string;
  status?: GenerationStatus | "ALL";
  page?: number;
}): Promise<AdminJobsPayload> {
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.q?.trim();
  const status = opts.status && opts.status !== "ALL" ? opts.status : undefined;
  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? { user: { email: { contains: q, mode: "insensitive" as const } } }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.generation.count({ where }),
    prisma.generation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        createdAt: true,
        type: true,
        status: true,
        creditsCost: true,
        errorMessage: true,
        user: { select: { email: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    pageSize: ADMIN_PAGE_SIZE,
    jobs: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      email: row.user.email,
      type: row.type,
      status: row.status,
      creditsCost: row.creditsCost,
      errorMessage: row.errorMessage,
    })),
  };
}

export async function updateAdminUserStatus(opts: {
  userId: string;
  actorId: string;
  status: AccountStatus;
}) {
  if (opts.userId === opts.actorId && opts.status === "BANNED") {
    throw new AdminOpsError("You cannot ban your own account", "CANNOT_BAN_SELF");
  }
  return prisma.user.update({
    where: { id: opts.userId },
    data: {
      status: opts.status,
      ...(opts.status === "BANNED" ? { coins: 0, securityAttempts: 2 } : {}),
    },
    select: { id: true, email: true, status: true, coins: true, role: true },
  });
}

export async function updateAdminUserRole(opts: {
  userId: string;
  actorId: string;
  role: UserRole;
}) {
  if (opts.userId === opts.actorId && opts.role !== "ADMIN") {
    throw new AdminOpsError(
      "You cannot remove your own admin role",
      "CANNOT_DEMOTE_SELF"
    );
  }
  if (opts.role !== "ADMIN") {
    const remaining = await prisma.user.count({
      where: { role: "ADMIN", id: { not: opts.userId } },
    });
    if (remaining === 0) {
      throw new AdminOpsError(
        "At least one ADMIN must remain",
        "LAST_ADMIN"
      );
    }
  }
  return prisma.user.update({
    where: { id: opts.userId },
    data: { role: opts.role },
    select: { id: true, email: true, status: true, coins: true, role: true },
  });
}

export async function adjustAdminUserNc(opts: {
  userId: string;
  delta: number;
  reason?: string;
}) {
  const delta = Math.trunc(opts.delta);
  if (!delta) throw new AdminOpsError("Adjustment cannot be zero", "ZERO_ADJUST");
  if (Math.abs(delta) > 100_000) {
    throw new AdminOpsError("Adjustment is too large", "ADJUST_TOO_LARGE");
  }

  return prisma.$transaction(async (tx) => {
    if (delta < 0) {
      const updated = await tx.user.updateMany({
        where: { id: opts.userId, coins: { gte: Math.abs(delta) } },
        data: { coins: { increment: delta } },
      });
      if (updated.count === 0) {
        throw new AdminOpsError(
          "Insufficient NC for this debit",
          "INSUFFICIENT_NC"
        );
      }
    } else {
      await tx.user.update({
        where: { id: opts.userId },
        data: { coins: { increment: delta } },
      });
    }

    const after = await tx.user.findUniqueOrThrow({
      where: { id: opts.userId },
      select: { id: true, email: true, coins: true, status: true, role: true },
    });

    await tx.coinLedger.create({
      data: {
        userId: opts.userId,
        delta,
        type: "ADJUSTMENT",
        reason: opts.reason?.trim() || "admin:adjust",
        balanceAfter: after.coins,
        metadata: { source: "admin_panel" },
      },
    });

    return after;
  });
}
