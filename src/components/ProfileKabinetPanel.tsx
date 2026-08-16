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
import { StatCard } from "@/components/StatCard";
import { profileHref } from "@/lib/profile-tabs";

const MediaLibrary = dynamic(
  () =>
    import("@/components/MediaLibrary").then((m) => ({
      default: m.MediaLibrary,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 animate-pulse rounded-2xl border border-nabi-border bg-nabi-card" />
    ),
  }
);

const NcReceiptHistory = dynamic(
  () =>
    import("@/components/NcReceiptHistory").then((m) => ({
      default: m.NcReceiptHistory,
    })),
  { ssr: false }
);

/**
 * Shaxsiy kabinet — balans + media kutubxona (Profile «Kabinet» tabi)
 */
export function ProfileKabinetPanel() {
  const { t } = useTranslations();
  const { coins, email, alnabiyKey } = useMaster();
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
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-nabi-neon">
          <LayoutDashboard size={14} />
          {t("dashboard_eyebrow")}
        </p>
        <h2 className="text-2xl font-bold md:text-3xl">{t("dashboard_title")}</h2>
        <p className="text-sm text-nabi-muted">{t("dashboard_subtitle")}</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={Coins}
          label={t("current_balance")}
          accent="gold"
          index={0}
          hint={t("coins")}
          value={
            <ClientOnly fallback="—">
              {formatCredits(displayCoins)}
            </ClientOnly>
          }
        />
        <StatCard
          icon={TrendingDown}
          label={t("dashboard_total_spent")}
          accent="rose"
          index={1}
          hint={t("dashboard_spent_hint")}
          value={
            <ClientOnly fallback="—">
              {formatCredits(stats.totalSpent)}
            </ClientOnly>
          }
        />
        <StatCard
          icon={Images}
          label={t("dashboard_assets")}
          accent="neon"
          index={2}
          hint={t("media_library_title")}
          value={
            <ClientOnly fallback="—">{stats.assetCount}</ClientOnly>
          }
        />
      </section>

      <section className="rounded-2xl border border-nabi-border bg-nabi-surface p-4 md:p-5">
        <h3 className="mb-3 text-sm font-semibold text-nabi-muted">
          {t("dashboard_profile_card")}
        </h3>
        <ClientOnly
          fallback={
            <p className="text-sm text-nabi-muted">{t("loading")}</p>
          }
        >
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] text-nabi-muted">{t("email_placeholder")}</dt>
              <dd className="truncate text-nabi-ink">
                {email || t("dashboard_guest")}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-nabi-muted">Al-Nabi Key</dt>
              <dd className="truncate font-mono text-xs text-nabi-neon">
                {alnabiyKey
                  ? `${alnabiyKey.slice(0, 8)}…${alnabiyKey.slice(-4)}`
                  : t("dashboard_no_key")}
              </dd>
            </div>
            <div className="flex items-end gap-2">
              <Link
                href={profileHref("dokon")}
                className="nabi-btn-primary !py-2 text-xs"
              >
                {t("store")}
              </Link>
              <Link
                href={profileHref("umumiy")}
                className="nabi-btn-ghost !py-2 text-xs"
              >
                {t("profile")}
              </Link>
            </div>
          </dl>
        </ClientOnly>
      </section>

      <NcReceiptHistory variant="full" />

      <MediaLibrary onStats={onStats} />
    </div>
  );
}
