"use client";

import { useCallback } from "react";
import { useMaster } from "@/context/MasterControllerContext";
import { t } from "./messages";
import type { LocaleCode } from "./config";

/**
 * React-i18next uslubidagi hook: const { t, locale } = useTranslations()
 */
export function useTranslations() {
  const { locale, setLocale, locales } = useMaster();

  const translate = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      t(locale, key, vars),
    [locale]
  );

  return {
    t: translate,
    locale: locale as LocaleCode,
    setLocale,
    locales,
  };
}
