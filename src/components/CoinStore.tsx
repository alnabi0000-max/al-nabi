"use client";

import { useCallback, useEffect, useState } from "react";
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
  totalCoins: number;
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

/**
 * Coin Store — narxlar faqat server geo-lock dan (boshqa tierlar yo'q)
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

      // Demo: soft credit + celebration
      const asCoinPack: CoinPack = {
        id: pack.id,
        name: pack.name,
        priceUsd: pack.price,
        coins: pack.coins,
        bonus: pack.bonus,
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
      <div className="mx-auto max-w-5xl animate-pulse space-y-4">
        <div className="mx-auto h-7 w-56 rounded-lg bg-nabi-elevated" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-nabi-card" />
          ))}
        </div>
      </div>
    );
  }

  const packs = pricing?.packs || [];

  return (
    <div className="relative">
      <h1 className="mb-1 text-center text-xl font-bold text-nabi-gold">
        {t("coin_store_title")}
      </h1>
      <p className="mb-2 text-center text-xs text-nabi-muted">
        {t("coin_store_subtitle")}
      </p>
      <p className="mb-1 text-center text-[11px] text-zinc-500">
        {t("rate_image")} · {t("rate_video")} · {t("rate_movie")}
      </p>
      <p className="mb-6 text-center text-[11px] text-nabi-neon/80">
        {t("geo_pricing_terms")}
        {pricing?.country && pricing.country !== "XX"
          ? ` · ${t("geo_region_applied", { code: pricing.country })}`
          : ` · ${t("geo_region_default")}`}
      </p>

      {error && (
        <p className="mb-4 text-center text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {packs.map((pack) => {
          const yieldInfo = packYield({
            id: pack.id,
            name: pack.name,
            priceUsd: pack.price,
            coins: pack.coins,
            bonus: pack.bonus,
            tag: pack.tag,
          });
          return (
            <button
              key={pack.id}
              type="button"
              onClick={() => void buy(pack)}
              disabled={isOffline || checkoutBusy === pack.id}
              className={clsx(
                "group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all duration-500 ease-apple will-change-transform hover:scale-[1.02] active:scale-[0.98]",
                pack.elite
                  ? "border-purple-500/50 bg-gradient-to-b from-purple-500/10 to-nabi-card shadow-[0_0_24px_rgba(168,85,247,0.25)]"
                  : pack.featured
                    ? "border-nabi-gold/50 bg-gradient-to-b from-amber-500/10 to-nabi-card shadow-gold"
                    : "border-nabi-border bg-nabi-card hover:border-nabi-gold/40"
              )}
            >
              <div className="mb-2 text-3xl drop-shadow-[0_0_8px_rgba(245,200,66,0.5)]">
                {pack.elite ? "💎" : pack.featured ? "👑" : "📦"}
              </div>
              <h3 className="text-sm font-bold text-nabi-gold">{pack.name}</h3>
              <p className="mt-2 text-lg font-extrabold text-white">
                {yieldInfo.total.toLocaleString()} {t("coins")}
              </p>
              {pack.bonus > 0 && (
                <p className="mt-1 text-xs font-semibold text-emerald-400">
                  {t("pack_bonus_tag", { n: pack.bonus })}
                </p>
              )}
              <p className="mt-3 text-xs text-nabi-muted">
                {t("real_price")}:{" "}
                <span className="font-semibold text-zinc-300">
                  {pack.priceFormatted}
                </span>
              </p>

              <div className="mt-3 space-y-1 rounded-xl border border-nabi-border/80 bg-[#0d0f12]/80 px-2.5 py-2 text-[10px] leading-relaxed text-zinc-400">
                <p>
                  {t("pack_yield_images", {
                    n: yieldInfo.images.toLocaleString(),
                  })}
                </p>
                <p>
                  {t("pack_yield_video", {
                    n: yieldInfo.videoMinutes.toLocaleString(),
                  })}
                </p>
                <p>
                  {t("pack_yield_movie", {
                    n: yieldInfo.movieMinutes.toLocaleString(),
                  })}
                </p>
              </div>

              <span className="mt-3 inline-flex rounded-lg border border-nabi-neon/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-nabi-neon transition-transform duration-300 group-hover:scale-[1.02]">
                {checkoutBusy === pack.id ? t("loading") : t("buy")}
              </span>
            </button>
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
