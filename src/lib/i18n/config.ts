export type LocaleCode =
  | "uz"
  | "en"
  | "ru"
  | "fr"
  | "ar"
  | "es"
  | "de"
  | "tr"
  | "zh"
  | "ja"
  | "ko"
  | "hi"
  | "pt"
  | "it"
  | "id"
  | "ms"
  | "fa"
  | "uk"
  | "pl"
  | "nl";

export interface LocaleMeta {
  code: LocaleCode;
  label: string;
  native: string;
  dir?: "ltr" | "rtl";
}

export const DEFAULT_LOCALE: LocaleCode = "uz";
export const LOCALE_COOKIE = "alnabiy_locale";
export const LOCALE_STORAGE = "alnabiy_locale";

/** World-standard UI locales (UN + major internet languages). */
export const LOCALES: LocaleMeta[] = [
  { code: "uz", label: "Uzbek", native: "Oʻzbek" },
  { code: "en", label: "English", native: "English" },
  { code: "zh", label: "Chinese", native: "中文" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "ar", label: "Arabic", native: "العربية", dir: "rtl" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "fr", label: "French", native: "Français" },
  { code: "ru", label: "Russian", native: "Русский" },
  { code: "pt", label: "Portuguese", native: "Português" },
  { code: "id", label: "Indonesian", native: "Bahasa Indonesia" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "tr", label: "Turkish", native: "Türkçe" },
  { code: "it", label: "Italian", native: "Italiano" },
  { code: "pl", label: "Polish", native: "Polski" },
  { code: "uk", label: "Ukrainian", native: "Українська" },
  { code: "nl", label: "Dutch", native: "Nederlands" },
  { code: "ms", label: "Malay", native: "Bahasa Melayu" },
  { code: "fa", label: "Persian", native: "فارسی", dir: "rtl" },
];

export const LOCALE_CODES = LOCALES.map((l) => l.code) as LocaleCode[];

export function isLocaleCode(v: string | null | undefined): v is LocaleCode {
  return !!v && (LOCALE_CODES as string[]).includes(v);
}
