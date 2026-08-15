"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  Check,
  Clapperboard,
  Crown,
  Film,
  Gem,
  Image,
  Package,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { useMaster } from "@/context/MasterControllerContext";
import { packYield, type CoinPack } from "@/lib/credits";
import { useIsMounted } from "@/hooks/useIsMounted";
import { useTranslations } from "@/lib/i18n/useTranslations";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import clsx from "clsx";

type GeoPack = {
  id: string;
  name: string;
  price: number;
  priceFormatted: string;
  currency: string;
  currencySymbol: string;
  coins: number;
  bonus: number;
  bonusPercent?: number;
  totalCoins: number;
  videoCapacity?: number;
  tag: string;
  featured?: boolean;
  elite?: boolean;
};

type PricingState = {
  packs: GeoPack[];
  regionToken: string;
  country: string;
  currencySymbol: string;
};

const PACK_ICONS: Record<string, LucideIcon> = {
  starter: Package,
  pro: Sparkles,
  creator: Clapperboard,
  business: Briefcase,
  studio: Gem,
};

/** Highlighted official mid-tier */
const RECOMMENDED_PACK_ID = "creator";

type CapacitySpec = {
  standardVideo: string;
  ultraVideo: string;
  imageOrAudio: string;
};

/**
 * Purchase-page capacity estimates. They use the advertised display rates:
 * 20 NC per 720p 5s video, 32 NC per 4K 5s video, and 2 NC per Flux HD
 * image or 150-character ElevenLabs clip.
 */
const CAPACITY_SPECS: Record<string, CapacitySpec> = {
  starter: {
    standardVideo: "Up to 8.7 minutes of Standard Video (~105 clips of 5s)",
    ultraVideo: "Up to 5.4 minutes of 4K Ultra Video (~65 clips)",
    imageOrAudio: "Up to 1,050 HD Images / Voiceovers",
  },
  pro: {
    standardVideo: "Up to 18.3 minutes of Standard Video (~220 clips of 5s)",
    ultraVideo: "Up to 11.4 minutes of 4K Ultra Video (~137 clips)",
    imageOrAudio: "Up to 2,200 HD Images / Voiceovers",
  },
  creator: {
    standardVideo: "Up to 28.7 minutes of Standard Video (~345 clips of 5s)",
    ultraVideo: "Up to 17.9 minutes of 4K Ultra Video (~215 clips)",
    imageOrAudio: "Up to 3,450 HD Images / Voiceovers",
  },
  business: {
    standardVideo: "Up to 40.0 minutes of Standard Video (~480 clips of 5s)",
    ultraVideo: "Up to 25.0 minutes of 4K Ultra Video (~300 clips)",
    imageOrAudio: "Up to 4,800 HD Images / Voiceovers",
  },
  studio: {
    standardVideo: "Up to 52.0 minutes of Standard Video (~625 clips of 5s)",
    ultraVideo: "Up to 32.5 minutes of 4K Ultra Video (~390 clips)",
    imageOrAudio: "Up to 6,250 HD Images / Voiceovers",
  },
};

/**
 * Official NC Store — fixed $20–$100 packages
 */
export function CoinStore() {
  const { purchasePack, isOffline, alnabiyKey } = useMaster();
  const { t, locale } = useTranslations();
  const isMounted = useIsMounted();
  const [pricing, setPricing] = useState<PricingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animPack, setAnimPack] = useState<GeoPack | null>(null);
  const [flyBonus, setFlyBonus] = useState(0);

  const loadPricing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(
        `/api/pricing?locale=${encodeURIComponent(locale)}`,
        {
          cache: "no-store",
          headers: { "x-alnabiy-locale": locale },
        },
        15_000
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || t("geo_pricing_failed"));
      }
      setPricing({
        packs: data.packs || [],
        regionToken: data.regionToken,
        country: data.country,
        currencySymbol: data.currencySymbol || "$",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error_generic"));
      setPricing(null);
    } finally {
      setLoading(false);
    }
  }, [locale, t]);

  useEffect(() => {
    if (!isMounted) return;
    void loadPricing();
  }, [isMounted, loadPricing]);

  async function buy(pack: GeoPack) {
    if (isOffline || checkoutBusy) return;
    setCheckoutBusy(pack.id);
    setError(null);
    try {
      const res = await fetchWithTimeout(
        "/api/checkout/create-session",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packId: pack.id,
            locale,
            alnabiyKey,
            clientPrice: pack.price,
          }),
        },
        20_000
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || t("checkout_failed"));
      }

      if (data.mode === "stripe" && data.url) {
        window.location.href = data.url;
        return;
      }

      const asCoinPack: CoinPack = {
        id: pack.id as CoinPack["id"],
        name: pack.name,
        priceUsd: pack.price,
        coins: pack.coins,
        bonus: pack.bonus,
        bonusPercent: pack.bonusPercent ?? 0,
        tag: pack.tag,
        featured: pack.featured,
        elite: pack.elite,
      };
      setAnimPack(pack);
      setFlyBonus(pack.bonus || pack.coins);
      purchasePack(asCoinPack);
      setTimeout(() => {
        setAnimPack(null);
        setFlyBonus(0);
      }, 2800);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error_generic"));
    } finally {
      setCheckoutBusy(null);
    }
  }

  if (!isMounted || loading) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-4">
        <div className="mx-auto h-7 w-56 rounded-lg bg-nabi-elevated" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[28rem] rounded-2xl bg-nabi-card" />
          ))}
        </div>
      </div>
    );
  }

  const packs = pricing?.packs || [];

  return (
    <div className="relative mx-auto max-w-6xl">
      <h1 className="mb-1 text-center text-xl font-bold text-nabi-gold md:text-2xl">
        {t("coin_store_title")}
      </h1>
      <p className="mb-2 text-center text-sm text-nabi-muted">
        {t("coin_store_subtitle")}
      </p>
      <div
        className="mx-auto mb-3 max-w-3xl rounded-xl border border-nabi-neon/20 bg-nabi-card/60 px-4 py-3 text-center text-xs leading-relaxed text-nabi-muted"
        title="Capacity estimates use 20 NC per 720p 5s video, 32 NC per 4K 5s video, and 2 NC per Flux HD image or 150-character ElevenLabs audio clip."
      >
        <p className="font-medium text-nabi-ink">
          Plan with 20 NC / 720p 5s Standard Video · 32 NC / 4K 5s Ultra
          Video · 2 NC / Flux HD Image or 150-character ElevenLabs Audio Clip
        </p>
        <p className="mt-1">
          Your NC credits can be mixed and matched freely across Video, Image,
          Audio, and Upscale.
        </p>
      </div>
      <p className="mb-8 text-center text-xs text-nabi-neon/80">
        {t("official_pricing_terms")}
      </p>

      {error && (
        <p className="mb-4 text-center text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}

      <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {packs.map((pack) => {
          const yieldInfo = packYield({
            coins: pack.coins,
            bonus: pack.bonus,
          });
          const bonusPercent =
            pack.bonusPercent ??
            (pack.coins > 0 ? Math.round((pack.bonus / pack.coins) * 100) : 0);
          const PackIcon = PACK_ICONS[pack.id] ?? Package;
          const isRecommended = pack.id === RECOMMENDED_PACK_ID;
          const busy = checkoutBusy === pack.id;
          const capacitySpec = CAPACITY_SPECS[pack.id];

          return (
            <article
              key={pack.id}
              className={clsx(
                "relative flex flex-col rounded-2xl border-2 p-5 transition-all duration-300",
                isRecommended
                  ? "border-nabi-gold bg-gradient-to-b from-amber-500/15 via-nabi-card to-nabi-card shadow-gold scale-[1.02] z-[1]"
                  : pack.elite
                    ? "border-nabi-neon/45 bg-gradient-to-b from-nabi-neon/10 to-nabi-card"
                    : "border-nabi-border bg-nabi-card hover:border-nabi-gold/35"
              )}
            >
              {isRecommended && (
                <span className="absolute -top-3 left-1/2 z-[2] -translate-x-1/2 whitespace-nowrap rounded-full border border-nabi-gold/60 bg-gradient-to-r from-amber-600 to-nabi-gold px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black shadow-md">
                  {t("pack_recommended")}
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
                  {pack.name}
                </h3>
              </div>

              <p className="text-3xl font-extrabold tracking-tight text-nabi-ink">
                {pack.priceFormatted}
              </p>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-nabi-gold">
                {yieldInfo.total.toLocaleString()} {t("coins")}
              </p>
              <p className="mt-1 text-xs text-nabi-muted">
                {t("pack_base_nc", { n: pack.coins.toLocaleString() })}
              </p>

              {bonusPercent > 0 ? (
                <p className="mt-2 inline-flex w-fit items-center rounded-md bg-emerald-500/15 px-2 py-1 text-sm font-semibold text-emerald-400">
                  {t("pack_bonus_percent", { percent: bonusPercent })}
                  <span className="ml-1 font-medium opacity-80">
                    ({t("pack_bonus_tag", { n: pack.bonus.toLocaleString() })})
                  </span>
                </p>
              ) : (
                <div className="mt-2 h-7" aria-hidden />
              )}

              <ul className="mt-5 flex flex-1 flex-col gap-3 border-t border-nabi-border/70 pt-4">
                {capacitySpec ? (
                  <>
                    <FeatureRow
                      icon={Film}
                      label={capacitySpec.standardVideo}
                    />
                    <FeatureRow
                      icon={Clapperboard}
                      label={capacitySpec.ultraVideo}
                    />
                    <FeatureRow
                      icon={Image}
                      label={capacitySpec.imageOrAudio}
                    />
                    <FeatureRow
                      icon={WandSparkles}
                      label="Full access to 4K/8K Upscale & AI Studio tools"
                      accent
                    />
                  </>
                ) : (
                  <FeatureRow
                    icon={Film}
                    label={t("pack_yield_videos", {
                      n: yieldInfo.videoClips.toLocaleString(),
                    })}
                  />
                )}
                {isRecommended && (
                  <FeatureRow
                    icon={Check}
                    label={t("pack_recommended_perk")}
                    accent
                  />
                )}
                {pack.elite && (
                  <FeatureRow
                    icon={Crown}
                    label={t("pack_studio_perk")}
                    accent
                  />
                )}
              </ul>

              <button
                type="button"
                onClick={() => void buy(pack)}
                disabled={isOffline || busy}
                className={clsx(
                  "mt-6 w-full rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200",
                  "hover:scale-[1.01] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
                  isRecommended
                    ? "bg-gradient-to-r from-amber-500 to-nabi-gold text-black shadow-[0_0_20px_rgba(245,200,66,0.35)]"
                    : "nabi-btn-primary"
                )}
              >
                {busy ? t("loading") : t("buy")}
              </button>
            </article>
          );
        })}
      </div>

      {animPack && (
        <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="chest-3d relative">
            <div className="chest-lid text-7xl">🎁</div>
            <div className="mt-4 text-center">
              <p className="text-lg font-bold text-nabi-gold">
                +{animPack.totalCoins.toLocaleString()} {t("coins")}
              </p>
              {animPack.bonus > 0 && (
                <p className="bonus-fly mt-2 text-sm font-semibold text-emerald-400">
                  +{flyBonus.toLocaleString()} {t("bonus_gift")} ✨
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  label,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  accent?: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={clsx(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
          accent
            ? "bg-nabi-gold/20 text-nabi-gold"
            : "bg-nabi-neon/10 text-nabi-neon"
        )}
      >
        <Icon className="h-3 w-3" aria-hidden />
      </span>
      <span
        className={clsx(
          "text-sm leading-snug",
          accent ? "font-medium text-nabi-gold" : "text-nabi-ink"
        )}
      >
        {label}
      </span>
    </li>
  );
}
