"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { LayoutDashboard, Coins, TrendingDown, Images } from "lucide-react";
import { useTranslations } from "@/lib/i18n/useTranslations";
import { useMaster } from "@/context/MasterControllerContext";
import { useIsMounted } from "@/hooks/useIsMounted";
import { formatCredits } from "@/lib/credits";
import { ClientOnly } from "@/components/ClientOnly";

const MediaLibrary = dynamic(
  () =>
    import("@/components/MediaLibrary").then((m) => ({
      default: m.MediaLibrary,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
    ),
  }
);

/**
 * Shaxsiy kabinet — balans + media kutubxona
 */
export default function DashboardPage() {
  const { t } = useTranslations();
  const { coins, email, alnabiyKey, referralCode } = useMaster();
  const mounted = useIsMounted();
  const [stats, setStats] = useState({
    totalSpent: 0,
    assetCount: 0,
    coins: null as number | null,
  });

  const onStats = useCallback(
    (s: { totalSpent: number; assetCount: number; coins: number | null }) => {
      setStats(s);
    },
    []
  );

  const displayCoins =
    mounted && stats.coins != null ? stats.coins : mounted ? coins : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-2">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-nabi-neon">
          <LayoutDashboard size={14} />
          {t("dashboard_eyebrow")}
        </p>
        <h1 className="text-2xl font-bold md:text-3xl">{t("dashboard_title")}</h1>
        <p className="text-sm text-nabi-muted">{t("dashboard_subtitle")}</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-nabi-border bg-gradient-to-br from-[#161a22] to-[#0d0f12] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-nabi-muted">
            <Coins size={14} className="text-nabi-gold" />
            {t("current_balance")}
          </div>
          <ClientOnly
            fallback={
              <p className="text-2xl font-semibold text-nabi-gold">—</p>
            }
          >
            <p className="text-2xl font-semibold text-nabi-gold">
              {formatCredits(displayCoins)}
            </p>
          </ClientOnly>
          <p className="mt-1 text-[11px] text-zinc-400">{t("coins")}</p>
        </div>

        <div className="rounded-2xl border border-nabi-border bg-gradient-to-br from-[#161a22] to-[#0d0f12] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-nabi-muted">
            <TrendingDown size={14} className="text-rose-300" />
            {t("dashboard_total_spent")}
          </div>
          <ClientOnly
            fallback={<p className="text-2xl font-semibold text-white">—</p>}
          >
            <p className="text-2xl font-semibold text-white">
              {formatCredits(stats.totalSpent)}
            </p>
          </ClientOnly>
          <p className="mt-1 text-[11px] text-zinc-400">
            {t("dashboard_spent_hint")}
          </p>
        </div>

        <div className="rounded-2xl border border-nabi-border bg-gradient-to-br from-[#161a22] to-[#0d0f12] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-nabi-muted">
            <Images size={14} className="text-nabi-neon" />
            {t("dashboard_assets")}
          </div>
          <ClientOnly
            fallback={<p className="text-2xl font-semibold text-nabi-neon">—</p>}
          >
            <p className="text-2xl font-semibold text-nabi-neon">
              {stats.assetCount}
            </p>
          </ClientOnly>
          <p className="mt-1 text-[11px] text-zinc-400">
            {t("media_library_title")}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-nabi-border bg-[#121418] p-4 md:p-5">
        <h2 className="mb-3 text-sm font-semibold text-nabi-muted">
          {t("dashboard_profile_card")}
        </h2>
        <ClientOnly
          fallback={
            <p className="text-sm text-zinc-500">{t("loading")}</p>
          }
        >
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] text-zinc-400">{t("email_placeholder")}</dt>
              <dd className="truncate text-white">
                {email || t("dashboard_guest")}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-zinc-400">Al-Nabi Key</dt>
              <dd className="truncate font-mono text-xs text-nabi-neon">
                {alnabiyKey
                  ? `${alnabiyKey.slice(0, 8)}…${alnabiyKey.slice(-4)}`
                  : t("dashboard_no_key")}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-zinc-400">{t("referral")}</dt>
              <dd className="truncate font-mono text-xs">{referralCode}</dd>
            </div>
            <div className="flex items-end gap-2">
              <Link href="/store" className="nabi-btn-primary !py-2 text-xs">
                {t("store")}
              </Link>
              <Link href="/profile" className="nabi-btn-ghost !py-2 text-xs">
                {t("profile")}
              </Link>
            </div>
          </dl>
        </ClientOnly>
      </section>

      <MediaLibrary onStats={onStats} />
    </div>
  );
}
