/**
 * Client-safe generation consent helpers.
 * Versions must stay aligned with CONSENT_DOCUMENT_VERSIONS in consent.ts.
 */
export const STUDIO_CONSENT_VERSION = "2026-08-20";

export const STUDIO_CONSENT_STORAGE_KEY =
  `alnabiy:studio-generation-consent:${STUDIO_CONSENT_VERSION}`;

export const STUDIO_REQUIRED_CONSENTS = [
  "TERMS",
  "PRIVACY",
  "AI_MEDIA_PROCESSING",
] as const;

export type StudioConsentDocument = (typeof STUDIO_REQUIRED_CONSENTS)[number];

export type StudioConsentStatus = {
  document: string;
  granted?: boolean;
  requiredForGeneration?: boolean;
};

export function readStoredStudioConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STUDIO_CONSENT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeStoredStudioConsent(accepted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STUDIO_CONSENT_STORAGE_KEY,
      accepted ? "1" : "0"
    );
  } catch {
    /* persist is optional — server records remain authoritative */
  }
}

export function requiredStudioConsentsGranted(
  consents: StudioConsentStatus[]
): boolean {
  return STUDIO_REQUIRED_CONSENTS.every((document) =>
    consents.some((row) => row.document === document && row.granted)
  );
}
