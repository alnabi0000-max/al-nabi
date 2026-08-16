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

export const LOCALES: LocaleMeta[] = [
  { code: "uz", label: "Uzbek", native: "O'zbek" },
  { code: "en", label: "English", native: "English" },
  { code: "ru", label: "Russian", native: "Русский" },
];

export const LOCALE_CODES = LOCALES.map((l) => l.code) as LocaleCode[];

export function isLocaleCode(v: string | null | undefined): v is LocaleCode {
  return !!v && (LOCALE_CODES as string[]).includes(v);
}
