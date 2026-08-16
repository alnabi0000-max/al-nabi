"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowUpRight,
  Coins,
  Loader2,
  RefreshCw,
  Shield,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import { useLanguage } from "@/context/LanguageContext";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import type {
  AdminAnalyticsPayload,
  AnalyticsRangeKey,
} from "@/lib/admin/analytics";
import { AdminRangeFilters } from "@/components/admin/AdminRangeFilters";
import {
  formatAdminWhen,
  formatNc,
  formatUsd,
} from "@/components/admin/admin-format";

const AdminIncomeChart = dynamic(
  () => import("./AdminCharts").then((m) => ({ default: m.AdminIncomeChart })),
  { ssr: false }
);

const AdminPackChart = dynamic(
  () => import("./AdminCharts").then((m) => ({ default: m.AdminPackChart })),
  { ssr: false }
);

export function AdminAnalyticsDashboard({
  initial,
}: {
  initial?: AdminAnalyticsPayload | null;
}) {
  const { t, locale } = useLanguage();
  const [range, setRange] = useState<AnalyticsRangeKey>(
    initial?.range.key && initial.range.key !== "custom"
      ? initial.range.key
      : "today"
  );
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<AdminAnalyticsPayload | null>(initial ?? null);
  const [busy, setBusy] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextRange: AnalyticsRangeKey, from?: string, to?: string) => {
      setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams({ range: nextRange });
        if (nextRange === "custom" && from && to) {
          params.set("from", from);
          params.set("to", to);
        }
        const res = await fetchWithTimeout(
          `/api/admin/analytics?${params.toString()}`,
          { credentials: "include", cache: "no-store" },
          20_000
        );
        const json = (await res.json()) as AdminAnalyticsPayload & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error || t.admin.loadError);
        }
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : t.admin.loadError);
      } finally {
        setBusy(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (initial && range === initial.range.key) return;
    if (range === "custom") return;
    void load(range);
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  const metrics = data?.metrics;
  const issued = metrics?.ncIssued ?? 0;
  const consumed = metrics?.ncConsumed ?? 0;
  const flowMax = Math.max(issued, consumed, 1);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-nabi-muted">
            <Shield size={12} />
            {t.admin.analyticsEyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-nabi-ink">
            {t.admin.analyticsTitle}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-nabi-muted">
            {t.admin.analyticsSubtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/ledger"
            className="inline-flex items-center gap-1.5 rounded-full border border-nabi-border px-3 py-1.5 text-xs text-nabi-muted hover:bg-nabi-elevated hover:text-nabi-ink"
          >
            {t.admin.openLedger}
            <ArrowUpRight size={12} />
          </Link>
          <button
            type="button"
            onClick={() =>
              void load(
                range,
                range === "custom" ? customFrom : undefined,
                range === "custom" ? customTo : undefined
              )
            }
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-nabi-border px-4 py-2 text-sm text-nabi-ink hover:bg-nabi-elevated disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            {t.common.refresh}
          </button>
        </div>
      </header>

      <AdminRangeFilters
        range={range}
        customFrom={customFrom}
        customTo={customTo}
        busy={busy}
        onRange={setRange}
        onCustomFrom={setCustomFrom}
        onCustomTo={setCustomTo}
        onApplyCustom={(from, to) => void load("custom", from, to)}
      />

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Wallet}
          label={t.admin.totalRevenue}
          value={metrics ? formatUsd(metrics.totalRevenueUsd) : "—"}
          hint={
            metrics
              ? `${metrics.paidOrderCount} ${t.admin.orders}`
              : t.common.loading
          }
        />
        <MetricCard
          icon={TrendingUp}
          label={t.admin.netProfit}
          value={metrics ? formatUsd(metrics.netProfitUsd) : "—"}
          hint={
            metrics
              ? `${t.admin.apiOverhead} ${formatUsd(metrics.estimatedApiCostUsd)}`
              : t.common.loading
          }
          accent
        />
        <MetricCard
          icon={Users}
          label={t.admin.activePayingUsers}
          value={metrics ? metrics.activePayingUsers.toLocaleString("en-US") : "—"}
          hint={
            metrics
              ? `${t.admin.lifetimePaying} ${metrics.lifetimePayingUsers.toLocaleString("en-US")}`
              : t.common.loading
          }
        />
        <MetricCard
          icon={Coins}
          label={t.admin.totalNcBalance}
          value={metrics ? formatNc(metrics.totalNcBalance) : "—"}
          hint={t.admin.totalNcBalanceHint}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-2xl border border-nabi-border bg-nabi-card p-4">
          <h2 className="text-sm font-medium text-nabi-ink">
            {t.admin.ncIssued} vs {t.admin.ncConsumed}
          </h2>
          <dl className="mt-4 space-y-3">
            <FlowRow
              label={t.admin.ncIssued}
              value={formatNc(issued)}
              ratio={issued / flowMax}
              tone="in"
            />
            <FlowRow
              label={t.admin.ncConsumed}
              value={formatNc(consumed)}
              ratio={consumed / flowMax}
              tone="out"
            />
          </dl>
          {metrics && (
            <p className="mt-4 text-xs text-nabi-muted">
              {t.admin.apiOverhead}: {formatUsd(metrics.estimatedApiCostUsd)}
            </p>
          )}
        </article>
        <article className="rounded-2xl border border-nabi-border bg-nabi-card p-4">
          <h2 className="text-sm font-medium text-nabi-ink">
            {t.admin.packBreakdown}
          </h2>
          {data?.packs?.length ? (
            <AdminPackChart data={data.packs.filter((p) => p.priceUsd > 0)} />
          ) : (
            <EmptyChart loading={busy} label={t.admin.emptyChart} />
          )}
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-nabi-border bg-nabi-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-nabi-border px-4 py-3">
          <h2 className="text-sm font-medium text-nabi-ink">{t.admin.cashflow}</h2>
          <Link
            href="/admin/ledger"
            className="inline-flex items-center gap-1 text-xs text-nabi-muted hover:text-nabi-ink"
          >
            {t.admin.openLedger}
            <ArrowUpRight size={12} />
          </Link>
        </div>
        {data?.ledgerByKind.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-nabi-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">{t.admin.colType}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.ncIssued}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.ncConsumed}</th>
                </tr>
              </thead>
              <tbody>
                {data.ledgerByKind.map((row) => (
                  <tr
                    key={row.type}
                    className="border-t border-nabi-border/80 text-nabi-ink"
                  >
                    <td className="px-4 py-2.5">{ledgerKindLabel(row.type, t)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-emerald-300">
                      {row.ncIssued ? formatNc(row.ncIssued) : "—"}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-rose-300">
                      {row.ncConsumed ? formatNc(row.ncConsumed) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-nabi-muted">
            {busy ? t.common.loading : t.admin.emptyLedger}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-nabi-border bg-nabi-card p-4">
        <h2 className="text-sm font-medium text-nabi-ink">{t.admin.dailyIncome}</h2>
        {data?.daily?.length ? (
          <AdminIncomeChart data={data.daily} />
        ) : (
          <EmptyChart loading={busy} label={t.admin.emptyChart} />
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-nabi-border bg-nabi-card">
        <div className="border-b border-nabi-border px-4 py-3">
          <h2 className="text-sm font-medium text-nabi-ink">
            {t.admin.recentTransactions}
          </h2>
        </div>
        {data?.recentTransactions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-nabi-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">{t.admin.colTime}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.colUser}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.colPack}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.colAmount}</th>
                  <th className="px-4 py-2 font-medium">{t.admin.colNc}</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTransactions.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-nabi-border/80 text-nabi-ink"
                  >
                    <td className="px-4 py-2.5 tabular-nums text-nabi-muted">
                      {formatAdminWhen(row.createdAt, locale)}
                    </td>
                    <td className="px-4 py-2.5">{row.email}</td>
                    <td className="px-4 py-2.5">
                      {row.packName} · ${row.amountUsd >= 1 ? Math.round(row.amountUsd) : row.amountUsd}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{formatUsd(row.amountUsd)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{formatNc(row.nc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-nabi-muted">
            {busy ? t.common.loading : t.admin.emptyTransactions}
          </p>
        )}
      </section>
    </div>
  );
}

function ledgerKindLabel(
  type: AdminAnalyticsPayload["ledgerByKind"][number]["type"],
  t: ReturnType<typeof useLanguage>["t"]
): string {
  switch (type) {
    case "SIGNUP_GRANT":
      return t.admin.kindSignupGrant;
    case "PURCHASE":
      return t.admin.kindPurchase;
    case "CHARGE":
      return t.admin.kindCharge;
    case "BONUS":
      return t.admin.kindBonus;
    case "REFERRAL":
      return t.admin.kindReferral;
    case "ROLLBACK":
      return t.admin.kindRollback;
    case "ADJUSTMENT":
      return t.admin.kindAdjustment;
    default:
      return type;
  }
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-nabi-border bg-nabi-card p-4">
      <p className="flex items-center gap-2 text-xs text-nabi-muted">
        <Icon size={14} />
        {label}
      </p>
      <p
        className={clsx(
          "mt-3 text-2xl font-semibold tabular-nums tracking-tight",
          accent ? "text-emerald-300" : "text-nabi-ink"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-nabi-muted">{hint}</p>
    </article>
  );
}

function FlowRow({
  label,
  value,
  ratio,
  tone,
}: {
  label: string;
  value: string;
  ratio: number;
  tone: "in" | "out";
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <dt className="text-nabi-muted">{label}</dt>
        <dd className="tabular-nums text-nabi-ink">{value}</dd>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-nabi-elevated">
        <div
          className={clsx(
            "h-full rounded-full",
            tone === "in" ? "bg-emerald-400" : "bg-rose-400"
          )}
          style={{ width: `${Math.min(100, Math.max(4, ratio * 100))}%` }}
        />
      </div>
    </div>
  );
}

function EmptyChart({ loading, label }: { loading: boolean; label: string }) {
  return (
    <div className="flex h-72 items-center justify-center text-sm text-nabi-muted">
      {loading ? <Loader2 size={18} className="animate-spin" /> : label}
    </div>
  );
}
