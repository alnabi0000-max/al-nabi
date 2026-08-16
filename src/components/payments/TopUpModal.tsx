"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Loader2, Wallet, X } from "lucide-react";
import { useTopUpUi } from "@/context/TopUpUiContext";
import { useAuthUi } from "@/context/AuthUiContext";
import { useMaster } from "@/context/MasterControllerContext";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import { isPackPriceId } from "@/lib/credits";
import {
  NcPackGrid,
  packDisplayName,
  type DisplayPack,
} from "@/components/payments/NcPackGrid";
import { useTranslations } from "@/lib/i18n/useTranslations";

const StripeEmbeddedCheckout = dynamic(
  () =>
    import("@/components/payments/StripeEmbeddedCheckout").then((m) => ({
      default: m.StripeEmbeddedCheckout,
    })),
  { ssr: false }
);

type PricingState = {
  packs: DisplayPack[];
};

type CheckoutPayload = {
  ok: boolean;
  mode?: "stripe" | "demo";
  error?: string;
  code?: string;
  url?: string | null;
  clientSecret?: string | null;
  publishableKey?: string | null;
  sessionId?: string;
  ncCredited?: number;
  quote?: { packId: string; coins?: number; bonus?: number };
};

export function TopUpModal() {
  const { open, packId, closeTopUp, celebrateTopUp } = useTopUpUi();
  const { openAuth } = useAuthUi();
  const { tr, email, alnabiyKey, notify, refreshSession } = useMaster();
  const { locale } = useTranslations();

  const [pricing, setPricing] = useState<PricingState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activePack, setActivePack] = useState<DisplayPack | null>(null);
  const [confirming, setConfirming] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const autoStarted = useRef<string | null>(null);

  const resetCheckout = useCallback(() => {
    setClientSecret(null);
    setPublishableKey(null);
    setSessionId(null);
    setActivePack(null);
    setConfirming(false);
    setBusyId(null);
    setError(null);
  }, []);

  useDialogFocus(panelRef, open, closeTopUp);

  useEffect(() => {
    if (!open) {
      resetCheckout();
      autoStarted.current = null;
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
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
          throw new Error(data.error || tr("geo_pricing_failed"));
        }
        if (!cancelled) {
          setPricing({ packs: data.packs || [] });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : tr("error_generic"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, locale, tr, resetCheckout]);

  const finishSuccess = useCallback(
    async (pack: DisplayPack, credited: number) => {
      await refreshSession();
      celebrateTopUp({
        totalNc: credited,
        packName: packDisplayName(pack, tr),
      });
      notify({
        type: "success",
        title: tr("topup_success_title"),
        message: tr("topup_success_body", { n: credited.toLocaleString() }),
        durationMs: 5600,
      });
      closeTopUp();
    },
    [celebrateTopUp, closeTopUp, notify, refreshSession, tr]
  );

  const pollPaid = useCallback(
    async (sid: string, pack: DisplayPack) => {
      setConfirming(true);
      const deadline = Date.now() + 45_000;
      while (Date.now() < deadline) {
        try {
          const res = await fetchWithTimeout(
            `/api/payments/checkout?session_id=${encodeURIComponent(sid)}`,
            { credentials: "include", cache: "no-store" },
            12_000
          );
          const data = await res.json();
          if (data.ok && data.paid) {
            const credited =
              typeof data.credited === "number"
                ? data.credited
                : pack.totalCoins;
            await finishSuccess(pack, credited);
            return;
          }
        } catch {
          /* retry */
        }
        await new Promise((r) => window.setTimeout(r, 1200));
      }
      await refreshSession();
      notify({
        type: "info",
        title: tr("topup_processing"),
        message: tr("topup_processing_hint"),
      });
      setConfirming(false);
    },
    [finishSuccess, notify, refreshSession, tr]
  );

  const startCheckout = useCallback(
    async (pack: DisplayPack) => {
      if (!email) {
        openAuth("quick");
        notify({
          type: "info",
          message: tr("topup_sign_in"),
        });
        return;
      }
      setBusyId(pack.id);
      setError(null);
      setActivePack(pack);
      try {
        const res = await fetchWithTimeout(
          "/api/payments/checkout",
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              packId: pack.id,
              locale,
              alnabiyKey,
              clientPrice: pack.price,
              uiMode: "embedded",
            }),
          },
          20_000
        );
        const data = (await res.json()) as CheckoutPayload;
        if (res.status === 401 || data.code === "AUTH_REQUIRED") {
          openAuth("quick");
          notify({ type: "info", message: tr("topup_sign_in") });
          return;
        }
        if (!res.ok || !data.ok) {
          throw new Error(data.error || tr("checkout_failed"));
        }
        if (data.mode === "demo") {
          const credited =
            data.ncCredited ||
            (data.quote?.coins || pack.coins) + (data.quote?.bonus || pack.bonus);
          await finishSuccess(pack, credited);
          return;
        }
        if (data.clientSecret && data.publishableKey) {
          setClientSecret(data.clientSecret);
          setPublishableKey(data.publishableKey);
          setSessionId(data.sessionId || null);
          return;
        }
        if (data.url) {
          window.location.href = data.url;
          return;
        }
        throw new Error(tr("checkout_failed"));
      } catch (e) {
        setError(e instanceof Error ? e.message : tr("error_generic"));
      } finally {
        setBusyId(null);
      }
    },
    [
      alnabiyKey,
      email,
      finishSuccess,
      locale,
      notify,
      openAuth,
      tr,
    ]
  );

  useEffect(() => {
    if (!open || !packId || !pricing || clientSecret) return;
    if (autoStarted.current === packId) return;
    const pack = pricing.packs.find((p) => p.id === packId);
    if (pack) {
      autoStarted.current = packId;
      void startCheckout(pack);
    }
  }, [open, packId, pricing, clientSecret, startCheckout]);

  if (!open) return null;

  const showingCheckout = Boolean(clientSecret && publishableKey && activePack);

  return (
    <div
      className="fixed inset-0 z-[88] flex items-end justify-center bg-black/80 p-4 backdrop-blur-md sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeTopUp();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={tr("topup_title")}
        tabIndex={-1}
        className="nabi-glass relative max-h-[92dvh] w-full max-w-5xl overflow-y-auto rounded-3xl p-6 shadow-neon outline-none backdrop-blur-2xl"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-cinema-glow opacity-40 blur-3xl"
        />

        <div className="relative mb-5 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-nabi-neon">
              Al-Nabi
            </p>
            <h2 className="text-xl font-bold leading-tight">
              {tr("topup_title")}
            </h2>
            <p className="text-xs text-nabi-muted">{tr("topup_subtitle")}</p>
            <p className="inline-flex items-center gap-1.5 pt-1 text-[11px] text-nabi-neon/90">
              <Wallet size={12} aria-hidden />
              {tr("topup_wallets")}
            </p>
          </div>
          <button
            type="button"
            onClick={closeTopUp}
            className="rounded-xl p-2 text-nabi-muted transition hover:bg-white/5 hover:text-nabi-ink"
            aria-label={tr("close")}
          >
            <X size={18} />
          </button>
        </div>

        {showingCheckout ? (
          <div className="relative space-y-3">
            <button
              type="button"
              onClick={resetCheckout}
              className="inline-flex items-center gap-1.5 text-[11px] text-nabi-muted transition hover:text-nabi-ink"
            >
              <ArrowLeft size={13} />
              {tr("auth_back")}
            </button>
            {confirming && (
              <p className="flex items-center gap-2 text-sm text-nabi-neon">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("topup_processing")}
              </p>
            )}
            <StripeEmbeddedCheckout
              clientSecret={clientSecret!}
              publishableKey={publishableKey!}
              onComplete={() => {
                if (sessionId && activePack) {
                  void pollPaid(sessionId, activePack);
                }
              }}
            />
          </div>
        ) : loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-52 animate-pulse rounded-2xl bg-nabi-elevated"
              />
            ))}
          </div>
        ) : (
          <>
            {error && (
              <p className="mb-4 text-center text-xs text-rose-400" role="alert">
                {error}
              </p>
            )}
            <NcPackGrid
              packs={pricing?.packs || []}
              busyId={busyId}
              compact
              onSelect={(pack) => {
                if (isPackPriceId(pack.id)) void startCheckout(pack);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
