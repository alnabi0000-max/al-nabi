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
import { getDictionary, type Dictionary } from "@/i18n/dictionary";
import { useMaster } from "@/context/MasterControllerContext";
import {
  ensureLocaleLoaded,
  isLocaleCode,
  type LocaleCode,
} from "@/lib/i18n/locales";

type LanguageCtx = {
  locale: LocaleCode;
  /** Nested dictionary for current locale — t.header.*, t.chat.*, t.nav.* */
  t: Dictionary;
  setLocale: (code: string) => void;
  locales: LocaleCode[];
};

const Ctx = createContext<LanguageCtx | null>(null);

/**
 * UI dictionary follows Master locale, including lazily loaded world packs.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { locale, locales, setLocale: setMasterLocale } = useMaster();
  const [packRev, setPackRev] = useState(0);

  useEffect(() => {
    let live = true;
    void ensureLocaleLoaded(locale).then((loaded) => {
      if (live && loaded) setPackRev((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, [locale]);

  const t = useMemo(() => getDictionary(locale), [locale, packRev]);

  const setLocale = useCallback(
    (code: string) => {
      if (isLocaleCode(code)) setMasterLocale(code);
    },
    [setMasterLocale]
  );

  const value = useMemo(
    () => ({
      locale,
      t,
      setLocale,
      locales: locales.map((item) => item.code),
    }),
    [locale, t, setLocale, locales]
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
