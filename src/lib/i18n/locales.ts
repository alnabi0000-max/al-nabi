/**
 * Orqa moslik qatlami — yangi kod `@/lib/i18n/messages` va `useTranslations` dan foydalansin.
 * JSON manba: src/locales/*.json
 */
export {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_STORAGE,
  DEFAULT_LOCALE,
  isLocaleCode,
  type LocaleCode,
  type LocaleMeta,
} from "./config";

export {
  t,
  getMessages,
  ensureLocaleLoaded,
  resolveLocale,
  type DictKey,
  type Messages,
} from "./messages";
