import type { LocaleCode } from "./config";
import { DEFAULT_LOCALE, isLocaleCode } from "./config";

/** Eager core locales only — other packs load on demand (cuts main-thread parse). */
import en from "@/locales/en.json";
import uz from "@/locales/uz.json";
import ru from "@/locales/ru.json";

export type Messages = Record<string, string>;
export type DictKey = keyof typeof en;

const CATALOG: Partial<Record<LocaleCode, Messages>> = {
  en: en as Messages,
  uz: uz as Messages,
  ru: ru as Messages,
};

const LOADERS: Partial<
  Record<LocaleCode, () => Promise<{ default: Messages }>>
> = {
  fr: () => import("@/locales/fr.json"),
  ar: () => import("@/locales/ar.json"),
  es: () => import("@/locales/es.json"),
  de: () => import("@/locales/de.json"),
  tr: () => import("@/locales/tr.json"),
  zh: () => import("@/locales/zh.json"),
  ja: () => import("@/locales/ja.json"),
  ko: () => import("@/locales/ko.json"),
  hi: () => import("@/locales/hi.json"),
  pt: () => import("@/locales/pt.json"),
  it: () => import("@/locales/it.json"),
  id: () => import("@/locales/id.json"),
  ms: () => import("@/locales/ms.json"),
  fa: () => import("@/locales/fa.json"),
  uk: () => import("@/locales/uk.json"),
  pl: () => import("@/locales/pl.json"),
  nl: () => import("@/locales/nl.json"),
};

const inflight = new Map<LocaleCode, Promise<boolean>>();

/** Sync read — falls back to EN until a lazy pack finishes loading. */
export function getMessages(locale: LocaleCode): Messages {
  return CATALOG[locale] || CATALOG.en!;
}

/** Prefetch a locale JSON chunk. Resolves `true` if a new pack was loaded. */
export function ensureLocaleLoaded(locale: LocaleCode): Promise<boolean> {
  if (CATALOG[locale]) return Promise.resolve(false);
  const loader = LOADERS[locale];
  if (!loader) return Promise.resolve(false);
  let p = inflight.get(locale);
  if (!p) {
    p = loader()
      .then((mod) => {
        CATALOG[locale] = mod.default as Messages;
        return true;
      })
      .catch(() => false)
      .finally(() => {
        inflight.delete(locale);
      });
    inflight.set(locale, p);
  }
  return p;
}

export function interpolate(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`
  );
}

/**
 * Markaziy tarjima.
 * Muhim: fallback faqat EN — o'zbekcha qoldiq boshqa tillarga o'tmaydi.
 */
export function t(
  locale: LocaleCode | string,
  key: string,
  vars?: Record<string, string | number>
): string {
  const code: LocaleCode = isLocaleCode(locale) ? locale : DEFAULT_LOCALE;
  const bag = getMessages(code);
  const enBag = CATALOG.en!;
  const raw = bag[key] ?? enBag[key] ?? key;
  return interpolate(raw, vars);
}

export function resolveLocale(
  ...candidates: Array<string | null | undefined>
): LocaleCode {
  for (const c of candidates) {
    if (isLocaleCode(c)) return c;
  }
  return DEFAULT_LOCALE;
}
