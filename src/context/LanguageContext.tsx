"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  dictionary,
  getDictionary,
  resolveAppLocale,
  type AppLocale,
  type Dictionary,
} from "@/i18n/dictionary";
import { LOCALE_STORAGE } from "@/lib/i18n/config";

type LanguageCtx = {
  locale: AppLocale;
  /** Nested dictionary for current locale — t.header.*, t.chat.*, t.nav.* */
  t: Dictionary;
  setLocale: (code: string) => void;
  locales: AppLocale[];
};

const Ctx = createContext<LanguageCtx | null>(null);

function readStoredLocale(): AppLocale {
  try {
    const fromLs = localStorage.getItem(LOCALE_STORAGE);
    if (fromLs) return resolveAppLocale(fromLs);
  } catch {
    /* soft */
  }
  return "uz";
}

/**
 * UI dictionary mirror of Master locale.
 * Persistence + cookie writes live only in MasterController.setLocale
 * to avoid dual localStorage / event storms.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>("uz");

  useEffect(() => {
    setLocaleState(readStoredLocale());
  }, []);

  /** Follow Master / other tabs — do not re-persist here */
  useEffect(() => {
    const onLocale = (e: Event) => {
      const detail = (e as CustomEvent<{ locale?: string }>).detail;
      if (!detail?.locale) return;
      const next = resolveAppLocale(detail.locale);
      setLocaleState((prev) => (prev === next ? prev : next));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCALE_STORAGE && e.newValue) {
        const next = resolveAppLocale(e.newValue);
        setLocaleState((prev) => (prev === next ? prev : next));
      }
    };
    window.addEventListener("alnabiy:locale", onLocale as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("alnabiy:locale", onLocale as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  /** Prefer MasterController.setLocale for persistence; this updates dictionary only. */
  const setLocale = useCallback((code: string) => {
    setLocaleState(resolveAppLocale(code));
  }, []);

  const t = useMemo(() => getDictionary(locale), [locale]);

  const value = useMemo(
    () => ({
      locale,
      t,
      setLocale,
      locales: Object.keys(dictionary) as AppLocale[],
    }),
    [locale, t, setLocale]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLanguage() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
