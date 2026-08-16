/**
 * Admin financial analytics — CoinLedger (CreditLedger) + Purchase (Transaction).
 *
 * Business calendar: Asia/Tashkent (UTC+5, no DST).
 */

import type { LedgerKind, PurchaseStatus } from "@prisma/client";
import {
  COIN_PACKS,
  USD_PER_COIN,
  getOfficialPack,
} from "@/lib/credits";
import { prisma } from "@/lib/prisma";

export const ADMIN_ANALYTICS_TIMEZONE = "Asia/Tashkent";
/** Tashkent does not observe DST. */
const TASHKENT_OFFSET = "+05:00";

export const ANALYTICS_RANGE_KEYS = [
  "today",
  "5days",
  "weekly",
  "monthly",
  "custom",
] as const;

export type AnalyticsRangeKey = (typeof ANALYTICS_RANGE_KEYS)[number];

export const PACK_TIER_USD = [20, 40, 60, 80, 100] as const;

/**
 * Estimated upstream inference COGS as a fraction of NC face value ($0.01).
 * Tuned for a mixed image/video workload (Flux / Kling / OpenRouter).
 */
export const API_OVERHEAD_RATIO = 0.38;

export const MAX_CUSTOM_RANGE_DAYS = 366;
export const RECENT_TRANSACTION_LIMIT = 30;

export class AnalyticsRangeError extends Error {
  readonly code = "INVALID_RANGE";
  constructor(message: string) {
    super(message);
    this.name = "AnalyticsRangeError";
  }
}

export type AnalyticsRangeBounds = {
  key: AnalyticsRangeKey;
  from: Date;
  to: Date;
  timezone: string;
};

export type AnalyticsWindow = {
  key: AnalyticsRangeKey;
  from: string;
  to: string;
  timezone: string;
};

export type PackBreakdownRow = {
  packId: string;
  name: string;
  priceUsd: number;
  revenueUsd: number;
  orders: number;
  ncIssued: number;
};

export type DailyIncomePoint = {
  date: string;
  revenueUsd: number;
  orders: number;
};

export type LedgerKindRow = {
  type: LedgerKind;
  ncIssued: number;
  ncConsumed: number;
};

export type RecentTransactionRow = {
  id: string;
  createdAt: string;
  email: string;
  packId: string;
  packName: string;
  amountUsd: number;
  nc: number;
  status: PurchaseStatus;
};

export type AdminAnalyticsPayload = {
  range: AnalyticsWindow;
  metrics: {
    totalRevenueUsd: number;
    estimatedApiCostUsd: number;
    netProfitUsd: number;
    ncIssued: number;
    ncConsumed: number;
    activePayingUsers: number;
    lifetimePayingUsers: number;
    totalNcBalance: number;
    paidOrderCount: number;
  };
  packs: PackBreakdownRow[];
  daily: DailyIncomePoint[];
  ledgerByKind: LedgerKindRow[];
  recentTransactions: RecentTransactionRow[];
};

function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

export function centsToUsd(cents: number): number {
  return roundUsd(Math.max(0, cents) / 100);
}

export function estimateApiOverheadUsd(ncConsumed: number): number {
  return roundUsd(Math.max(0, ncConsumed) * USD_PER_COIN * API_OVERHEAD_RATIO);
}

export function netProfitUsd(revenueUsd: number, overheadUsd: number): number {
  return roundUsd(revenueUsd - overheadUsd);
}

export function isAnalyticsRangeKey(value: string): value is AnalyticsRangeKey {
  return (ANALYTICS_RANGE_KEYS as readonly string[]).includes(value);
}

/** Calendar YYYY-MM-DD in the business timezone. */
export function zonedYmd(
  date: Date,
  timeZone = ADMIN_ANALYTICS_TIMEZONE
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function startOfZonedDay(
  date: Date,
  timeZone = ADMIN_ANALYTICS_TIMEZONE
): Date {
  return new Date(`${zonedYmd(date, timeZone)}T00:00:00${TASHKENT_OFFSET}`);
}

export function addZonedDays(start: Date, days: number): Date {
  return new Date(start.getTime() + days * 86_400_000);
}

function parseIsoOrYmd(
  raw: string,
  bound: "start" | "end"
): Date {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    if (bound === "start") {
      return new Date(`${trimmed}T00:00:00${TASHKENT_OFFSET}`);
    }
    return addZonedDays(new Date(`${trimmed}T00:00:00${TASHKENT_OFFSET}`), 1);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new AnalyticsRangeError("Invalid custom date");
  }
  return parsed;
}

export function resolveAnalyticsRange(
  key: AnalyticsRangeKey,
  now = new Date(),
  custom?: { from?: string; to?: string }
): AnalyticsRangeBounds {
  const timezone = ADMIN_ANALYTICS_TIMEZONE;
  const to = now;
  const startToday = startOfZonedDay(now);

  if (key === "custom") {
    if (!custom?.from || !custom?.to) {
      throw new AnalyticsRangeError("Custom range requires from and to");
    }
    const from = parseIsoOrYmd(custom.from, "start");
    const end = parseIsoOrYmd(custom.to, "end");
    if (!(end.getTime() > from.getTime())) {
      throw new AnalyticsRangeError("Custom range end must be after start");
    }
    const spanDays = (end.getTime() - from.getTime()) / 86_400_000;
    if (spanDays > MAX_CUSTOM_RANGE_DAYS) {
      throw new AnalyticsRangeError("Custom range cannot exceed 366 days");
    }
    return { key, from, to: end, timezone };
  }

  const days =
    key === "today" ? 1 : key === "5days" ? 5 : key === "weekly" ? 7 : 30;
  const from = addZonedDays(startToday, -(days - 1));
  return { key, from, to, timezone };
}

export function fillDailySeries(
  from: Date,
  to: Date,
  points: DailyIncomePoint[]
): DailyIncomePoint[] {
  const map = new Map(points.map((p) => [p.date, p]));
  const out: DailyIncomePoint[] = [];
  let cursor = startOfZonedDay(from);
  const endMs = to.getTime();
  while (cursor.getTime() < endMs) {
    const date = zonedYmd(cursor);
    out.push(map.get(date) ?? { date, revenueUsd: 0, orders: 0 });
    cursor = addZonedDays(cursor, 1);
    if (out.length > MAX_CUSTOM_RANGE_DAYS + 2) break;
  }
  return out;
}

export function resolvePackTier(
  packId: string,
  amountCents: number
): { packId: string; name: string; priceUsd: number } {
  const official = getOfficialPack(packId);
  if (official) {
    return {
      packId: official.id,
      name: official.name,
      priceUsd: official.priceUsd,
    };
  }
  const usd = Math.round(amountCents / 100);
  const byPrice = COIN_PACKS.find((p) => p.priceUsd === usd);
  if (byPrice) {
    return {
      packId: byPrice.id,
      name: byPrice.name,
      priceUsd: byPrice.priceUsd,
    };
  }
  return {
    packId: packId || "other",
    name: "Other",
    priceUsd: centsToUsd(amountCents),
  };
}

export function emptyPackBreakdown(): PackBreakdownRow[] {
  return COIN_PACKS.map((pack) => ({
    packId: pack.id,
    name: pack.name,
    priceUsd: pack.priceUsd,
    revenueUsd: 0,
    orders: 0,
    ncIssued: 0,
  }));
}

export function aggregatePackBreakdown(
  rows: Array<{
    packId: string;
    amountCents: number;
    coins: number;
    bonus: number;
  }>
): PackBreakdownRow[] {
  const byId = new Map(
    emptyPackBreakdown().map((row) => [row.packId, { ...row }])
  );
  for (const row of rows) {
    const tier = resolvePackTier(row.packId, row.amountCents);
    const current = byId.get(tier.packId) ?? {
      packId: tier.packId,
      name: tier.name,
      priceUsd: tier.priceUsd,
      revenueUsd: 0,
      orders: 0,
      ncIssued: 0,
    };
    current.revenueUsd = roundUsd(current.revenueUsd + centsToUsd(row.amountCents));
    current.orders += 1;
    current.ncIssued += Math.max(0, row.coins + row.bonus);
    byId.set(tier.packId, current);
  }
  const official = COIN_PACKS.map((p) => byId.get(p.id)!);
  const extras = [...byId.values()].filter(
    (row) => !COIN_PACKS.some((p) => p.id === row.packId) && row.orders > 0
  );
  return [...official, ...extras];
}

type PurchaseLite = {
  id: string;
  createdAt: Date;
  packId: string;
  amountCents: number;
  coins: number;
  bonus: number;
  userId: string;
  status: PurchaseStatus;
  user: { email: string };
};

function dailyFromPurchases(rows: PurchaseLite[]): DailyIncomePoint[] {
  const map = new Map<string, DailyIncomePoint>();
  for (const row of rows) {
    const date = zonedYmd(row.createdAt);
    const current = map.get(date) ?? { date, revenueUsd: 0, orders: 0 };
    current.revenueUsd = roundUsd(current.revenueUsd + centsToUsd(row.amountCents));
    current.orders += 1;
    map.set(date, current);
  }
  return [...map.values()];
}

export async function loadAdminAnalytics(opts: {
  range: AnalyticsRangeKey;
  from?: string;
  to?: string;
  now?: Date;
}): Promise<AdminAnalyticsPayload> {
  const bounds = resolveAnalyticsRange(opts.range, opts.now ?? new Date(), {
    from: opts.from,
    to: opts.to,
  });
  const createdAt = { gte: bounds.from, lt: bounds.to };

  const [
    paidPurchases,
    ledgerByKind,
    totalNcAgg,
    lifetimePaying,
  ] = await Promise.all([
    prisma.purchase.findMany({
      where: { status: "PAID", createdAt },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        packId: true,
        amountCents: true,
        coins: true,
        bonus: true,
        userId: true,
        status: true,
        user: { select: { email: true } },
      },
    }),
    prisma.coinLedger.groupBy({
      by: ["type"],
      where: { createdAt },
      _sum: { delta: true },
    }),
    prisma.user.aggregate({ _sum: { coins: true } }),
    prisma.purchase.groupBy({
      by: ["userId"],
      where: { status: "PAID" },
    }),
  ]);

  const revenueCents = paidPurchases.reduce(
    (sum, row) => sum + row.amountCents,
    0
  );
  const totalRevenueUsd = centsToUsd(revenueCents);

  const ledgerRows: LedgerKindRow[] = ledgerByKind.map((row) => {
    const delta = row._sum.delta ?? 0;
    return {
      type: row.type,
      ncIssued: delta > 0 ? delta : 0,
      ncConsumed: delta < 0 ? Math.abs(delta) : 0,
    };
  });

  const ncIssued = ledgerRows.reduce((sum, row) => sum + row.ncIssued, 0);
  const chargeConsumed =
    ledgerRows.find((row) => row.type === "CHARGE")?.ncConsumed ?? 0;
  const allConsumed = ledgerRows.reduce((sum, row) => sum + row.ncConsumed, 0);
  const ncConsumed = chargeConsumed > 0 ? chargeConsumed : allConsumed;

  const estimatedApiCostUsd = estimateApiOverheadUsd(ncConsumed);
  const payingUserIds = new Set(paidPurchases.map((row) => row.userId));

  const recentTransactions: RecentTransactionRow[] = paidPurchases
    .slice(0, RECENT_TRANSACTION_LIMIT)
    .map((row) => {
      const tier = resolvePackTier(row.packId, row.amountCents);
      return {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        email: row.user.email,
        packId: tier.packId,
        packName: tier.name,
        amountUsd: centsToUsd(row.amountCents),
        nc: row.coins + row.bonus,
        status: row.status,
      };
    });

  return {
    range: {
      key: bounds.key,
      from: bounds.from.toISOString(),
      to: bounds.to.toISOString(),
      timezone: bounds.timezone,
    },
    metrics: {
      totalRevenueUsd,
      estimatedApiCostUsd,
      netProfitUsd: netProfitUsd(totalRevenueUsd, estimatedApiCostUsd),
      ncIssued,
      ncConsumed,
      activePayingUsers: payingUserIds.size,
      lifetimePayingUsers: lifetimePaying.length,
      totalNcBalance: totalNcAgg._sum.coins ?? 0,
      paidOrderCount: paidPurchases.length,
    },
    packs: aggregatePackBreakdown(paidPurchases),
    daily: fillDailySeries(
      bounds.from,
      bounds.to,
      dailyFromPurchases(paidPurchases)
    ),
    ledgerByKind: ledgerRows,
    recentTransactions,
  };
}
