export const TRANSLATOR_LANGUAGES = [
  { id: "uz", label: "O‘zbekcha" },
  { id: "ru", label: "Русский" },
  { id: "en", label: "English" },
  { id: "tr", label: "Türkçe" },
  { id: "ar", label: "العربية" },
  { id: "es", label: "Español" },
] as const;

export type TranslatorLanguageId = (typeof TRANSLATOR_LANGUAGES)[number]["id"];

export const TRANSLATOR_VIDEO_MAX_BYTES = 80 * 1024 * 1024;
export const TRANSLATOR_AUDIO_MAX_BYTES = 10 * 1024 * 1024;

export type TranslatorJobDraft = {
  sourceVideoName: string | null;
  sourceVideoSize: number;
  voiceSampleName: string | null;
  sourceLanguage: TranslatorLanguageId;
  targetLanguage: TranslatorLanguageId;
  lipSync: boolean;
  consent: boolean;
  providerReady: false;
};

export function languageLabel(id: TranslatorLanguageId): string {
  return TRANSLATOR_LANGUAGES.find((lang) => lang.id === id)?.label ?? id;
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
