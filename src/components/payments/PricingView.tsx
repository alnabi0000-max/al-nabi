"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "@/lib/i18n/useTranslations";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import { useTopUpUi } from "@/context/TopUpUiContext";
import {
  NcPackGrid,
  type DisplayPack,
} from "@/components/payments/NcPackGrid";
import { isPackPriceId } from "@/lib/credits";

export function PricingView({
  variant = "page",
}: {
  variant?: "page" | "store";
}) {
  const { t, locale } = useTranslations();
  const { openTopUp } = useTopUpUi();
  const [packs, setPacks] = useState<DisplayPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setPacks(data.packs || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error_generic"));
      setPacks([]);
    } finally {
      setLoading(false);
    }
  }, [locale, t]);

  useEffect(() => {
    void loadPricing();
  }, [loadPricing]);

  return (
    <div className="relative mx-auto max-w-6xl">
      <h1 className="mb-1 text-center text-xl font-bold text-nabi-gold md:text-2xl">
        {variant === "store" ? t("coin_store_title") : t("pricing_title")}
      </h1>
      {variant === "store" ? (
        <p className="mb-2 text-center text-sm text-nabi-muted">
          {t("coin_store_subtitle")}
        </p>
      ) : null}
      <div className="glass-card mx-auto mb-3 max-w-3xl rounded-xl px-4 py-3 text-center text-xs leading-relaxed text-nabi-muted">
        <p>{t("pricing_mix_hint")}</p>
      </div>
      <p className="mb-8 text-center text-xs text-nabi-neon/80">
        {t("official_pricing_terms")}
      </p>

      {error && (
        <p className="mb-4 text-center text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[28rem] animate-pulse rounded-2xl bg-nabi-card" />
          ))}
        </div>
      ) : (
        <NcPackGrid
          packs={packs}
          onSelect={(pack) => {
            if (isPackPriceId(pack.id)) openTopUp(pack.id);
          }}
        />
      )}
    </div>
  );
}
