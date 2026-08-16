"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DEMO_STARTING_CREDITS,
  LS_ATTEMPTS,
  LS_COINS,
  LS_KEY,
  LS_LOCALE,
  LS_QUEUE,
  LS_STATUS,
  type CoinPack,
  type GenerationKind,
  COIN_PACKS,
  REFERRAL_REWARD,
} from "@/lib/credits";
import {
  LOCALES,
  LOCALE_COOKIE,
  t,
  isLocaleCode,
  ensureLocaleLoaded,
  type LocaleCode,
} from "@/lib/i18n/locales";
import { shouldBypassLowDataMode } from "@/lib/security/client-mode";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";

interface AiQueue {
  seedance: string;
  pending: number;
}

export interface ChargeReceipt {
  receiptId: string;
  cost: number;
  bonusGift: number;
  balanceAfter: number;
  label: string;
  at: string;
}

export type AppToastState = {
  message: string;
  type: "error" | "success" | "info";
  title?: string;
  durationMs?: number;
  id: number;
};

interface MasterState {
  coins: number;
  alnabiyKey: string | null;
  email: string | null;
  locale: LocaleCode;
  isBanned: boolean;
  isOffline: boolean;
  securityAttempts: number;
  identityLocked: boolean;
  aiQueue: AiQueue;
  referralCode: string;
}

interface MasterController extends MasterState {
  packs: CoinPack[];
  locales: typeof LOCALES;
  tr: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (code: LocaleCode) => void;
  addCoins: (amount: number, reason?: string) => void;
  deductCoins: (amount: number) => boolean;
  /**
   * Backend credit gate orqali yech + sandiq/receipt;
   * yetarli bo'lmasa qizil neon modal.
   */
  chargeGeneration: (opts: {
    kind: GenerationKind;
    durationSec?: number;
    label?: string;
  }) => Promise<boolean>;
  /** Server charge natijasini UI ga sinxronlash (guard + celebration) */
  applyServerCharge: (result: {
    ok: boolean;
    code?: string;
    cost?: number;
    balanceAfter?: number;
    receiptId?: string;
    bonusGift?: number;
    label?: string;
    kind?: string;
  }) => boolean;
  purchasePack: (pack: CoinPack) => void;
  setIdentityLocked: (v: boolean) => void;
  handleViolation: () => void;
  verifyKey: (email: string, key: string) => Promise<{ ok: boolean; message: string }>;
  signInWithPassword: (
    email: string,
    password: string,
    register?: boolean
  ) => Promise<{ ok: boolean; message: string }>;
  signOut: () => Promise<void>;
  /** Local/dev: guest yoki mavjud sessionni kafolatlaydi */
  ensureAuthSession: () => Promise<{
    ok: boolean;
    alnabiyKey: string | null;
  }>;
  /** Serverdagi sessiyani qayta o'qish — OTP / OAuth kirishdan keyin */
  refreshSession: () => Promise<void>;
  authReady: boolean;
  authMode: "local" | "supabase";
  setOffline: (v: boolean) => void;
  persist: () => void;
  showCyberToast: boolean;
  triggerCyberToast: () => void;
  showBanScreen: boolean;
  showHalolModal: boolean;
  setShowHalolModal: (v: boolean) => void;
  showInsufficientModal: boolean;
  setShowInsufficientModal: (v: boolean) => void;
  chargeReceipt: ChargeReceipt | null;
  clearChargeReceipt: () => void;
  lowDataMode: boolean;
  setLowDataMode: (v: boolean) => void;
  appToast: AppToastState | null;
  notify: (opts: {
    message: string;
    type?: AppToastState["type"];
    title?: string;
    durationMs?: number;
  }) => void;
  clearAppToast: () => void;
}

const Ctx = createContext<MasterController | null>(null);

/** Server + birinchi client render — bir xil (hydration-safe) */
function safeInitial(): MasterState {
  return {
    coins: DEMO_STARTING_CREDITS,
    alnabiyKey: null,
    email: null,
    locale: "uz",
    isBanned: false,
    isOffline: false,
    securityAttempts: 0,
    identityLocked: false,
    aiQueue: { seedance: "idle", pending: 0 },
    referralCode: "ALNABIY-DEMO",
  };
}

/** Faqat client mount dan keyin — alnabiy_coins / alnabiy_key */
function loadFromStorage(): MasterState {
  try {
    const coins = parseInt(
      localStorage.getItem(LS_COINS) || String(DEMO_STARTING_CREDITS),
      10
    );
    const status = localStorage.getItem(LS_STATUS);
    const attempts = parseInt(localStorage.getItem(LS_ATTEMPTS) || "0", 10);
    const cookieLocale = document.cookie
      .split("; ")
      .find((r) => r.startsWith(`${LOCALE_COOKIE}=`))
      ?.split("=")[1];
    const stored = localStorage.getItem(LS_LOCALE) || cookieLocale || "uz";
    const locale = (isLocaleCode(stored) ? stored : "uz") as LocaleCode;
    const key = localStorage.getItem(LS_KEY);
    const queueRaw = localStorage.getItem(LS_QUEUE);
    const session = localStorage.getItem("alnabiy_session");
    let email: string | null = null;
    let referralCode = "ALNABIY-DEMO";
    if (session) {
      const s = JSON.parse(session);
      email = s.email || null;
      if (s.referralCode) referralCode = s.referralCode;
    }
    return {
      coins: Number.isFinite(coins) ? coins : DEMO_STARTING_CREDITS,
      alnabiyKey: key,
      email,
      locale,
      isBanned: status === "BANNED",
      isOffline: !navigator.onLine,
      securityAttempts: attempts,
      identityLocked: false,
      aiQueue: queueRaw ? JSON.parse(queueRaw) : { seedance: "idle", pending: 0 },
      referralCode,
    };
  } catch {
    return safeInitial();
  }
}

export function MasterControllerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<MasterState>(safeInitial);
  const [hydrated, setHydrated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<"local" | "supabase">("local");
  const [showCyberToast, setShowCyberToast] = useState(false);
  const [showHalolModal, setShowHalolModal] = useState(false);
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
  const [chargeReceipt, setChargeReceipt] = useState<ChargeReceipt | null>(
    null
  );
  const [lowDataMode, setLowDataMode] = useState(false);
  const [appToast, setAppToast] = useState<AppToastState | null>(null);

  const notify = useCallback(
    (opts: {
      message: string;
      type?: AppToastState["type"];
      title?: string;
      durationMs?: number;
    }) => {
      setAppToast({
        id: Date.now(),
        message: opts.message,
        type: opts.type || "info",
        title: opts.title,
        durationMs: opts.durationMs,
      });
    },
    []
  );
  const clearAppToast = useCallback(() => setAppToast(null), []);

  const applyAuthPayload = useCallback(
    (email: string, data: Record<string, unknown>, keyFallback?: string) => {
      const nextCoins =
        typeof data.coins === "number"
          ? data.coins
          : typeof data.alnabiyCoins === "number"
            ? (data.alnabiyCoins as number)
            : undefined;
      const key =
        (data.alnabiy_key as string) ||
        (data.alnabiyKey as string) ||
        keyFallback ||
        null;
      const mode =
        data.mode === "supabase" || data.mode === "local"
          ? (data.mode as "local" | "supabase")
          : null;
      if (mode) setAuthMode(mode);
      setState((s) => ({
        ...s,
        email,
        alnabiyKey: key,
        coins: nextCoins ?? s.coins,
        referralCode: (data.referralCode as string) || s.referralCode,
        isBanned: data.status === "BANNED",
      }));
      /* Persistence deferred to debounced persistNow — only keep key hot */
      try {
        if (key) localStorage.setItem(LS_KEY, key);
      } catch {
        /* soft */
      }
    },
    []
  );

  const syncSessionFromApi = useCallback(async () => {
    const res = await fetchWithTimeout(
      "/api/auth/me",
      { credentials: "include" },
      15_000
    );
    const data = await res.json();
    let key: string | null = null;
    try {
      key = localStorage.getItem(LS_KEY);
    } catch {
      /* soft */
    }

    /* One ensure call — covers authenticated + local guest boot */
    try {
      const ens = await fetchWithTimeout(
        "/api/auth/ensure",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alnabiyKey: key }),
        },
        15_000
      );
      const ensData = await ens.json();
      if (ens.ok && ensData.authenticated) {
        applyAuthPayload(
          ensData.email || data.email || "dev@alnabiy.local",
          {
            ...(data as Record<string, unknown>),
            ...(ensData as Record<string, unknown>),
          },
          (ensData.alnabiyKey ||
            ensData.alnabiy_key ||
            key ||
            undefined) as string | undefined
        );
        return ensData;
      }
    } catch {
      /* soft */
    }

    if (data.authenticated) {
      applyAuthPayload(
        data.email || "dev@alnabiy.local",
        data as Record<string, unknown>,
        key || undefined
      );
    } else {
      setState((s) => ({ ...s, email: null }));
    }
    return data;
  }, [applyAuthPayload]);

  /** OTP / OAuth kirishdan keyin serverdagi sessiyani qayta o'qish */
  const refreshSession = useCallback(async () => {
    try {
      await syncSessionFromApi();
    } catch {
      /* soft — keyingi navigatsiyada qayta urinadi */
    }
  }, [syncSessionFromApi]);

  /** Generate oldidan — sessiya/guest kafolat */
  const ensureAuthSession = useCallback(async () => {
    if (state.email && state.alnabiyKey) {
      return { ok: true as const, alnabiyKey: state.alnabiyKey };
    }
    try {
      let lsKey: string | null = state.alnabiyKey;
      try {
        lsKey = lsKey || localStorage.getItem(LS_KEY);
      } catch {}
      const ens = await fetchWithTimeout(
        "/api/auth/ensure",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alnabiyKey: lsKey }),
        },
        15_000
      );
      const ensData = await ens.json();
      if (ens.ok && ensData.authenticated) {
        applyAuthPayload(
          ensData.email || "dev@alnabiy.local",
          ensData as Record<string, unknown>
        );
        return {
          ok: true as const,
          alnabiyKey: (ensData.alnabiyKey ||
            ensData.alnabiy_key) as string,
        };
      }
      return { ok: false as const, alnabiyKey: null };
    } catch {
      return { ok: false as const, alnabiyKey: null };
    }
  }, [state.email, state.alnabiyKey, applyAuthPayload]);

  /* Hydration: LS + server session (/api/auth/me) + soft ensure */
  useEffect(() => {
    setState(loadFromStorage());
    setHydrated(true);

    let cancelled = false;
    (async () => {
      try {
        await syncSessionFromApi();
      } catch {
        /* offline / soft */
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [syncSessionFromApi]);

  /* OAuth / Magic Link — only when Supabase is configured (avoids 656KB client) */
  useEffect(() => {
    if (!authReady) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { isSupabaseConfigured } = await import("@/lib/auth/config");
        if (!isSupabaseConfigured() || cancelled) return;
        const { createClient } = await import("@/lib/supabase/client");
        if (cancelled) return;
        const supabase = createClient();
        if (!supabase) return;
        const { data } = supabase.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
            void syncSessionFromApi();
          }
          if (event === "SIGNED_OUT") {
            setState((s) => ({
              ...s,
              email: null,
              alnabiyKey: null,
              referralCode: "ALNABIY-DEMO",
            }));
          }
        });
        unsub = () => data.subscription.unsubscribe();
      } catch {
        /* no supabase */
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [authReady, syncSessionFromApi]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const hydratedRef = useRef(hydrated);
  hydratedRef.current = hydrated;

  /** Sync flush — used on pagehide / beforeunload only. */
  const persistNow = useCallback(() => {
    if (!hydratedRef.current) return;
    const s = stateRef.current;
    try {
      localStorage.setItem(LS_COINS, String(s.coins));
      localStorage.setItem(LS_STATUS, s.isBanned ? "BANNED" : "ACTIVE");
      localStorage.setItem(LS_ATTEMPTS, String(s.securityAttempts));
      localStorage.setItem(LS_LOCALE, s.locale);
      localStorage.setItem(LS_QUEUE, JSON.stringify(s.aiQueue));
      if (s.alnabiyKey) localStorage.setItem(LS_KEY, s.alnabiyKey);
      localStorage.setItem(
        "alnabiy_session",
        JSON.stringify({
          email: s.email,
          coins: s.coins,
          referralCode: s.referralCode,
          ts: Date.now(),
        })
      );
    } catch {
      /* soft */
    }
  }, []);

  /* Debounced persist — avoids 7× localStorage writes on every auth/toast tick */
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(persistNow, 450);
    return () => window.clearTimeout(timer);
  }, [state, hydrated, persistNow]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      document.documentElement.lang = state.locale;
      const meta = LOCALES.find((l) => l.code === state.locale);
      document.documentElement.dir = meta?.dir || "ltr";
      document.cookie = `${LOCALE_COOKIE}=${state.locale};path=/;max-age=31536000;SameSite=Lax`;
    } catch {
      /* soft */
    }
    void ensureLocaleLoaded(state.locale).then((loaded) => {
      if (!loaded) return;
      setState((s) => (s.locale === state.locale ? { ...s } : s));
    });
  }, [state.locale, hydrated]);

  useEffect(() => {
    const onOffline = () => setState((s) => ({ ...s, isOffline: true }));
    const onOnline = () => setState((s) => ({ ...s, isOffline: false }));
    const flush = () => persistNow();
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    /* pagehide/visibility only — beforeunload blocks bfcache restoration */
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [persistNow]);

  /* Network telemetry — mobil data / Wi-Fi (localhost/dev da o‘chiq) */
  useEffect(() => {
    if (shouldBypassLowDataMode()) {
      setLowDataMode(false);
      return;
    }
    const conn = (navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        saveData?: boolean;
        addEventListener?: (type: string, listener: () => void) => void;
        removeEventListener?: (type: string, listener: () => void) => void;
      };
    }).connection;
    if (!conn) return;
    const check = () => {
      const slow =
        conn.saveData ||
        conn.effectiveType === "2g" ||
        conn.effectiveType === "slow-2g" ||
        conn.effectiveType === "3g";
      setLowDataMode(!!slow);
    };
    check();
    conn.addEventListener?.("change", check);
    return () => conn.removeEventListener?.("change", check);
  }, []);

  const tr = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      t(state.locale, key, vars),
    [state.locale]
  );

  const setLocale = useCallback((code: LocaleCode) => {
    setState((s) => ({ ...s, locale: code }));
    void ensureLocaleLoaded(code).then((loaded) => {
      if (!loaded) return;
      setState((s) => (s.locale === code ? { ...s } : s));
    });
    try {
      localStorage.setItem(LS_LOCALE, code);
      document.cookie = `${LOCALE_COOKIE}=${code};path=/;max-age=31536000;SameSite=Lax`;
      document.documentElement.lang = code;
      const meta = LOCALES.find((l) => l.code === code);
      document.documentElement.dir = meta?.dir || "ltr";
      window.dispatchEvent(
        new CustomEvent("alnabiy:locale", { detail: { locale: code } })
      );
    } catch {
      /* soft */
    }
  }, []);

  const addCoins = useCallback((amount: number) => {
    setState((s) => ({ ...s, coins: s.coins + amount }));
  }, []);

  const deductCoins = useCallback((amount: number) => {
    let ok = false;
    setState((s) => {
      if (s.coins < amount) return s;
      ok = true;
      return { ...s, coins: s.coins - amount };
    });
    return ok;
  }, []);

  const chargeGeneration = useCallback(
    async (opts: {
      kind: GenerationKind;
      durationSec?: number;
      label?: string;
    }) => {
      try {
        const res = await fetchWithTimeout(
          "/api/credits/charge",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: opts.kind,
              durationSec: opts.durationSec ?? 60,
              alnabiyKey: state.alnabiyKey,
              clientBalance: state.coins,
              reason: opts.label || opts.kind,
            }),
          },
          20_000
        );
        const data = await res.json();
        if (!data.ok || data.code === "INSUFFICIENT") {
          setShowInsufficientModal(true);
          return false;
        }
        const cost = Number(data.cost) || 0;
        const bonus = Number(data.bonusGift) || 0;
        /* Prefer the server's post-charge balance over a client-computed
         * one — avoids desync when the server balance already reflects a
         * concurrent charge/refund the client doesn't know about yet. */
        let balanceAfter =
          typeof data.balanceAfter === "number" ? data.balanceAfter : state.coins;
        setState((s) => {
          const next =
            typeof data.balanceAfter === "number"
              ? data.balanceAfter
              : Math.max(0, s.coins - cost + bonus);
          balanceAfter = next;
          return { ...s, coins: next };
        });
        stateRef.current = { ...stateRef.current, coins: balanceAfter };
        setChargeReceipt({
          receiptId: data.receiptId || `RCPT-${Date.now()}`,
          cost,
          bonusGift: bonus,
          balanceAfter:
            typeof data.balanceAfter === "number"
              ? data.balanceAfter
              : balanceAfter,
          label: opts.label || opts.kind,
          at: new Date().toISOString(),
        });
        if (cost > 0) {
          void import("@/lib/nc-receipts")
            .then((m) =>
              m.upsertNcReceipt({
                id: data.receiptId as string | undefined,
                receiptId: data.receiptId as string | undefined,
                kind: opts.kind,
                title: opts.label || opts.kind,
                creditsCost: cost,
                durationSec: opts.durationSec,
                balanceAfter:
                  typeof data.balanceAfter === "number"
                    ? data.balanceAfter
                    : balanceAfter,
              })
            )
            .catch(() => {});
        }
        setTimeout(() => setChargeReceipt(null), 4200);
        return true;
      } catch {
        setShowInsufficientModal(true);
        return false;
      }
    },
    [state.alnabiyKey, state.coins]
  );

  const applyServerCharge = useCallback(
    (result: {
      ok: boolean;
      code?: string;
      cost?: number;
      balanceAfter?: number;
      receiptId?: string;
      bonusGift?: number;
      label?: string;
      kind?: string;
    }) => {
      if (!result.ok || result.code === "INSUFFICIENT") {
        setShowInsufficientModal(true);
        return false;
      }
      if (typeof result.balanceAfter === "number") {
        setState((s) => ({ ...s, coins: result.balanceAfter! }));
        /* Update the ref synchronously too — persistNow (debounce timer /
         * pagehide / visibilitychange) reads stateRef.current, which only
         * reflects this new balance once React re-renders. Without this,
         * a flush that fires in the small window before the next render
         * would persist the *old* coin count and clobber the LS write
         * below with a stale value. */
        stateRef.current = { ...stateRef.current, coins: result.balanceAfter };
        try {
          localStorage.setItem(LS_COINS, String(result.balanceAfter));
        } catch {}
      }
      const charged = result.cost;
      if (
        typeof charged === "number" &&
        charged > 0 &&
        (result.receiptId || result.kind === "vault")
      ) {
        void import("@/lib/nc-receipts")
          .then((m) =>
            m.upsertNcReceipt({
              id: result.receiptId,
              receiptId: result.receiptId,
              kind: (result.kind as
                | "image"
                | "prompt_to_video"
                | "text_to_movie"
                | "vault"
                | "other") || "other",
              title: result.label || "NC",
              creditsCost: charged,
              balanceAfter: result.balanceAfter,
            })
          )
          .catch(() => {});
      }
      /* Charge celebration / "Rozimisiz?" modal — o‘chirilgan; silent debit */
      return true;
    },
    [state.coins]
  );

  /** Demo/local soft credit only — production coins come from Stripe webhook. */
  const purchasePack = useCallback((pack: CoinPack) => {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.NEXT_PUBLIC_AUTH_MODE !== "local" &&
      process.env.AUTH_MODE !== "local"
    ) {
      return;
    }
    const total = pack.coins + pack.bonus;
    setState((s) => ({ ...s, coins: s.coins + total }));
  }, []);

  /** FUNC-01: 3-tier progressive warning → restrict → ban */
  const handleViolation = useCallback(() => {
    setState((s) => {
      const next = s.securityAttempts + 1;
      try {
        localStorage.setItem(LS_ATTEMPTS, String(next));
      } catch {}

      /* Tier 1: ogohlantirish */
      if (next === 1) {
        return { ...s, securityAttempts: next };
      }

      /* Tier 2: soft restrict — yangi render cheklanmagan, lekin ogohlantirish kuchayadi */
      if (next === 2) {
        return { ...s, securityAttempts: next };
      }

      /* Tier 3+: ban + coins freeze */
      try {
        localStorage.setItem(LS_STATUS, "BANNED");
        localStorage.setItem(LS_COINS, "0");
      } catch {}
      if (s.alnabiyKey) {
        fetch("/api/security/ban", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-alnabiy-key": s.alnabiyKey,
          },
          body: JSON.stringify({
            alnabiyKey: s.alnabiyKey,
            attempts: next,
            reason: "halol_18plus_regex_tier3",
            tier: 3,
          }),
        }).catch(() => {});
      }
      return {
        ...s,
        securityAttempts: next,
        isBanned: true,
        coins: 0,
      };
    });
    setShowHalolModal(true);
  }, []);

  const verifyKey = useCallback(
    async (email: string, key: string) => {
      try {
        const res = await fetchWithTimeout(
          "/api/auth/verify-key",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, alnabiyKey: key, alnabiy_key: key }),
          },
          20_000
        );
        const data = await res.json();
        if (!res.ok)
          return {
            ok: false,
            message: data.error || t(state.locale, "error_generic"),
          };
        applyAuthPayload(email, data, key);
        return { ok: true, message: t(state.locale, "session_restored") };
      } catch {
        return { ok: false, message: t(state.locale, "network_error") };
      }
    },
    [state.locale, applyAuthPayload]
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string, register = false) => {
      try {
        const res = await fetchWithTimeout(
          "/api/auth/login",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password, register }),
          },
          20_000
        );
        const data = await res.json();
        if (!res.ok) {
          return {
            ok: false,
            message: data.error || t(state.locale, "error_generic"),
          };
        }
        if (data.mode === "local" || data.mode === "supabase") {
          setAuthMode(data.mode);
        }
        applyAuthPayload(email, data);
        return {
          ok: true,
          message: register
            ? t(state.locale, "account_created")
            : t(state.locale, "session_restored"),
        };
      } catch {
        return { ok: false, message: t(state.locale, "network_error") };
      }
    },
    [state.locale, applyAuthPayload]
  );

  const signOut = useCallback(async () => {
    try {
      await fetchWithTimeout(
        "/api/auth/logout",
        { method: "POST", credentials: "include" },
        10_000
      );
    } catch {}
    setState((s) => ({
      ...s,
      email: null,
      alnabiyKey: null,
      referralCode: "ALNABIY-DEMO",
    }));
    try {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem("alnabiy_session");
    } catch {}
  }, []);

  const triggerCyberToast = useCallback(() => {
    setShowCyberToast(true);
    setTimeout(() => setShowCyberToast(false), 2000);
  }, []);

  const value = useMemo<MasterController>(
    () => ({
      ...state,
      packs: COIN_PACKS,
      locales: LOCALES,
      tr,
      setLocale,
      addCoins,
      deductCoins,
      chargeGeneration,
      applyServerCharge,
      purchasePack,
      setIdentityLocked: (v) => setState((s) => ({ ...s, identityLocked: v })),
      handleViolation,
      verifyKey,
      signInWithPassword,
      signOut,
      ensureAuthSession,
      refreshSession,
      authReady,
      authMode,
      setOffline: (v) => setState((s) => ({ ...s, isOffline: v })),
      persist: persistNow,
      showCyberToast,
      triggerCyberToast,
      showBanScreen: state.isBanned,
      showHalolModal,
      setShowHalolModal,
      showInsufficientModal,
      setShowInsufficientModal,
      chargeReceipt,
      clearChargeReceipt: () => setChargeReceipt(null),
      lowDataMode,
      setLowDataMode,
      appToast,
      notify,
      clearAppToast,
    }),
    [
      state,
      tr,
      setLocale,
      addCoins,
      deductCoins,
      chargeGeneration,
      applyServerCharge,
      purchasePack,
      handleViolation,
      verifyKey,
      signInWithPassword,
      signOut,
      ensureAuthSession,
      refreshSession,
      authReady,
      authMode,
      persistNow,
      showCyberToast,
      triggerCyberToast,
      showHalolModal,
      showInsufficientModal,
      chargeReceipt,
      lowDataMode,
      appToast,
      notify,
      clearAppToast,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMaster() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMaster must be used within MasterControllerProvider");
  return ctx;
}

export { REFERRAL_REWARD };
