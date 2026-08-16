"use client";

import {
  Briefcase,
  Check,
  Clapperboard,
  Crown,
  Film,
  Gem,
  Package,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { packYield, type PackPriceId } from "@/lib/credits";
import { useMaster } from "@/context/MasterControllerContext";

export type DisplayPack = {
  id: string;
  name: string;
  price: number;
  priceFormatted: string;
  coins: number;
  bonus: number;
  bonusPercent?: number;
  totalCoins: number;
  standardVideos?: number;
  ultra4kVideos?: number;
  tag: string;
  featured?: boolean;
  elite?: boolean;
};

const PACK_ICONS: Record<string, LucideIcon> = {
  starter: Package,
  pro: Sparkles,
  creator: Clapperboard,
  business: Briefcase,
  studio: Gem,
};

const RECOMMENDED_PACK_ID: PackPriceId = "creator";

export function packDisplayName(
  pack: Pick<DisplayPack, "id" | "name">,
  tr: (key: string) => string
): string {
  const key = `pack_name_${pack.id}`;
  const translated = tr(key);
  return translated === key ? pack.name : translated;
}

export function NcPackGrid({
  packs,
  busyId,
  compact,
  onSelect,
}: {
  packs: DisplayPack[];
  busyId?: string | null;
  compact?: boolean;
  onSelect: (pack: DisplayPack) => void;
}) {
  const { tr, isOffline } = useMaster();

  return (
    <div
      className={clsx(
        "grid items-stretch gap-4",
        compact
          ? "sm:grid-cols-2"
          : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5"
      )}
    >
      {packs.map((pack) => {
        const yieldInfo = packYield({
          coins: pack.coins,
          bonus: pack.bonus,
        });
        const standard =
          pack.standardVideos ?? yieldInfo.standardVideos;
        const ultra = pack.ultra4kVideos ?? yieldInfo.ultra4kVideos;
        const bonusPercent =
          pack.bonusPercent ??
          (pack.coins > 0 ? Math.round((pack.bonus / pack.coins) * 100) : 0);
        const PackIcon = PACK_ICONS[pack.id] ?? Package;
        const isRecommended = pack.id === RECOMMENDED_PACK_ID;
        const busy = busyId === pack.id;
        const name = packDisplayName(pack, tr);

        return (
          <article
            key={pack.id}
            className={clsx(
              "relative flex flex-col rounded-2xl border-2 p-5 transition-all duration-300 nabi-glass backdrop-blur-xl",
              isRecommended
                ? "border-nabi-gold bg-gradient-to-b from-amber-500/15 via-nabi-card to-nabi-card shadow-gold scale-[1.02] z-[1]"
                : pack.elite
                  ? "border-nabi-neon/45 bg-gradient-to-b from-nabi-neon/10 to-nabi-card"
                  : "border-nabi-border hover:border-nabi-gold/35"
            )}
          >
            {isRecommended && (
              <span className="absolute -top-3 left-1/2 z-[2] -translate-x-1/2 whitespace-nowrap rounded-full border border-nabi-gold/60 bg-gradient-to-r from-amber-600 to-nabi-gold px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black shadow-md">
                {tr("pack_recommended")}
              </span>
            )}

            <div className="mb-4 flex items-center gap-2.5 pt-1">
              <span
                className={clsx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                  isRecommended
                    ? "border-nabi-gold/50 bg-amber-500/15 text-nabi-gold"
                    : pack.elite
                      ? "border-nabi-neon/40 bg-nabi-neon/15 text-nabi-neon"
                      : "border-nabi-border bg-nabi-card text-nabi-neon"
                )}
              >
                <PackIcon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="text-base font-bold leading-tight text-nabi-ink">
                {name}
              </h3>
            </div>

            <p className="text-3xl font-extrabold tracking-tight text-nabi-ink">
              {pack.priceFormatted}
            </p>
            <p className="mt-1.5 text-lg font-bold tabular-nums text-nabi-gold">
              {yieldInfo.total.toLocaleString()} {tr("coins")}
            </p>
            <p className="mt-1 text-xs text-nabi-muted">
              {tr("pack_base_nc", { n: pack.coins.toLocaleString() })}
            </p>

            {bonusPercent > 0 ? (
              <p className="mt-2 inline-flex w-fit items-center rounded-md bg-emerald-500/15 px-2 py-1 text-sm font-semibold text-emerald-400">
                {tr("pack_bonus_percent", { percent: bonusPercent })}
                <span className="ml-1 font-medium opacity-80">
                  ({tr("pack_bonus_tag", { n: pack.bonus.toLocaleString() })})
                </span>
              </p>
            ) : (
              <div className="mt-2 h-7" aria-hidden />
            )}

            <ul className="mt-5 flex flex-1 flex-col gap-3 border-t border-nabi-border/70 pt-4">
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-nabi-neon/10 text-nabi-neon">
                  <Film className="h-3 w-3" aria-hidden />
                </span>
                <span className="text-sm leading-snug text-nabi-ink">
                  {tr("pricing_capacity", {
                    standard,
                    ultra,
                  })}
                </span>
              </li>
              {isRecommended && (
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-nabi-gold/20 text-nabi-gold">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                  <span className="text-sm font-medium text-nabi-gold">
                    {tr("pack_recommended_perk")}
                  </span>
                </li>
              )}
              {pack.elite && (
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-nabi-gold/20 text-nabi-gold">
                    <Crown className="h-3 w-3" aria-hidden />
                  </span>
                  <span className="text-sm font-medium text-nabi-gold">
                    {tr("pack_studio_perk")}
                  </span>
                </li>
              )}
            </ul>

            <button
              type="button"
              onClick={() => onSelect(pack)}
              disabled={isOffline || busy}
              className={clsx(
                "mt-6 w-full rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200",
                "hover:scale-[1.01] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
                isRecommended
                  ? "bg-gradient-to-r from-amber-500 to-nabi-gold text-black shadow-[0_0_20px_rgba(245,200,66,0.35)]"
                  : "nabi-btn-primary"
              )}
            >
              {busy ? tr("loading") : tr("buy")}
            </button>
          </article>
        );
      })}
    </div>
  );
}
