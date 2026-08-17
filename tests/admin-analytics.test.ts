import { describe, expect, it } from "vitest";
import { requiresSessionToken } from "@/lib/auth/protected-routes";
import { isAdminRole } from "@/lib/admin/roles";
import {
  API_OVERHEAD_RATIO,
  AnalyticsRangeError,
  PACK_TIER_USD,
  addZonedDays,
  aggregatePackBreakdown,
  centsToUsd,
  estimateApiOverheadUsd,
  fillDailySeries,
  isAnalyticsRangeKey,
  netProfitUsd,
  resolveAnalyticsRange,
  resolvePackTier,
  startOfZonedDay,
  zonedYmd,
} from "@/lib/admin/analytics";
import { USD_PER_COIN } from "@/lib/credits";
import { AdminOpsError } from "@/lib/admin/ops";

const NOON_TASHKENT = new Date("2026-08-16T12:00:00+05:00");

describe("admin role gate", () => {
  it("accepts only the exact ADMIN role", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("USER")).toBe(false);
    expect(isAdminRole("MODERATOR")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });
});

describe("admin ops errors", () => {
  it("carries a stable code for panel actions", () => {
    const err = new AdminOpsError("Adjustment cannot be zero", "ZERO_ADJUST");
    expect(err.name).toBe("AdminOpsError");
    expect(err.code).toBe("ZERO_ADJUST");
  });
});

describe("admin analytics API surface", () => {
  it("requires a session instead of ADMIN_API_SECRET", () => {
    expect(requiresSessionToken("/api/admin/analytics")).toBe(true);
    expect(requiresSessionToken("/api/admin/passcode")).toBe(true);
    expect(requiresSessionToken("/api/admin/ledger")).toBe(true);
    expect(requiresSessionToken("/api/admin/users")).toBe(true);
    expect(requiresSessionToken("/api/admin/jobs")).toBe(true);
    expect(requiresSessionToken("/api/admin/unlock")).toBe(false);
    expect(requiresSessionToken("/api/admin/models")).toBe(true);
    expect(requiresSessionToken("/api/admin/models/approve")).toBe(true);
    expect(requiresSessionToken("/api/admin/system")).toBe(true);
  });
});

describe("analytics date windows", () => {
  it("resolves Bugun / 5 kun / 1 hafta / 1 oy from Tashkent midnight", () => {
    const today = resolveAnalyticsRange("today", NOON_TASHKENT);
    expect(today.from.toISOString()).toBe(
      startOfZonedDay(NOON_TASHKENT).toISOString()
    );
    expect(zonedYmd(today.from)).toBe("2026-08-16");

    const five = resolveAnalyticsRange("5days", NOON_TASHKENT);
    expect(zonedYmd(five.from)).toBe("2026-08-12");

    const week = resolveAnalyticsRange("weekly", NOON_TASHKENT);
    expect(zonedYmd(week.from)).toBe("2026-08-10");

    const month = resolveAnalyticsRange("monthly", NOON_TASHKENT);
    expect(zonedYmd(month.from)).toBe("2026-07-18");
  });

  it("parses an inclusive custom calendar range", () => {
    const custom = resolveAnalyticsRange("custom", NOON_TASHKENT, {
      from: "2026-08-01",
      to: "2026-08-03",
    });
    expect(zonedYmd(custom.from)).toBe("2026-08-01");
    expect(zonedYmd(custom.to)).toBe("2026-08-04");
  });

  it("rejects inverted or oversized custom ranges", () => {
    expect(() =>
      resolveAnalyticsRange("custom", NOON_TASHKENT, {
        from: "2026-08-10",
        to: "2026-08-01",
      })
    ).toThrow(AnalyticsRangeError);
    expect(() => resolveAnalyticsRange("custom", NOON_TASHKENT, {})).toThrow(
      AnalyticsRangeError
    );
    expect(isAnalyticsRangeKey("weekly")).toBe(true);
    expect(isAnalyticsRangeKey("year")).toBe(false);
  });

  it("fills missing days with zero revenue", () => {
    const from = startOfZonedDay(NOON_TASHKENT);
    const to = addZonedDays(from, 3);
    const series = fillDailySeries(from, to, [
      { date: "2026-08-16", revenueUsd: 40, orders: 1 },
    ]);
    expect(series.map((p) => p.date)).toEqual([
      "2026-08-16",
      "2026-08-17",
      "2026-08-18",
    ]);
    expect(series[1]).toEqual({ date: "2026-08-17", revenueUsd: 0, orders: 0 });
  });
});

describe("financial metrics", () => {
  it("maps official $20–$100 package tiers", () => {
    expect(PACK_TIER_USD).toEqual([20, 40, 60, 80, 100]);
    expect(resolvePackTier("starter", 2000)).toMatchObject({
      packId: "starter",
      priceUsd: 20,
    });
    expect(resolvePackTier("unknown", 6000)).toMatchObject({
      packId: "creator",
      priceUsd: 60,
    });
  });

  it("aggregates package sales and net profit after API overhead", () => {
    const packs = aggregatePackBreakdown([
      { packId: "starter", amountCents: 2000, coins: 2000, bonus: 100 },
      { packId: "starter", amountCents: 2000, coins: 2000, bonus: 100 },
      { packId: "studio", amountCents: 10000, coins: 10000, bonus: 2500 },
    ]);
    const starter = packs.find((p) => p.packId === "starter");
    const studio = packs.find((p) => p.packId === "studio");
    const pro = packs.find((p) => p.packId === "pro");
    expect(starter).toMatchObject({ orders: 2, revenueUsd: 40, ncIssued: 4200 });
    expect(studio).toMatchObject({ orders: 1, revenueUsd: 100 });
    expect(pro).toMatchObject({ orders: 0, revenueUsd: 0 });

    const revenue = centsToUsd(14000);
    const overhead = estimateApiOverheadUsd(5000);
    expect(revenue).toBe(140);
    expect(overhead).toBe(5000 * USD_PER_COIN * API_OVERHEAD_RATIO);
    expect(netProfitUsd(revenue, overhead)).toBe(140 - overhead);
  });
});
