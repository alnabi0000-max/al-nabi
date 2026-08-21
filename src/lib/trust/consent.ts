import {
  ConsentAction,
  ConsentDocument,
  type UserConsent,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Bump a document version whenever its published text changes materially.
 * Historical rows are retained so past affirmative consent remains auditable.
 */
export const CONSENT_DOCUMENT_VERSIONS = {
  TERMS: "2026-08-20",
  PRIVACY: "2026-08-20",
  AI_MEDIA_PROCESSING: "2026-08-20",
  PRODUCT_IMPROVEMENT: "2026-08-20",
} as const satisfies Record<ConsentDocument, string>;

export const REQUIRED_GENERATION_CONSENTS: readonly ConsentDocument[] = [
  ConsentDocument.TERMS,
  ConsentDocument.PRIVACY,
  ConsentDocument.AI_MEDIA_PROCESSING,
];

const WITHDRAWABLE_DOCUMENTS = new Set<ConsentDocument>([
  ConsentDocument.AI_MEDIA_PROCESSING,
  ConsentDocument.PRODUCT_IMPROVEMENT,
]);

export type PublicConsentStatus = {
  document: ConsentDocument;
  version: string;
  granted: boolean;
  requiredForGeneration: boolean;
  withdrawable: boolean;
  recordedAt: string | null;
};

function currentVersion(document: ConsentDocument): string {
  return CONSENT_DOCUMENT_VERSIONS[document];
}

function toPublicStatus(
  document: ConsentDocument,
  row: UserConsent | null
): PublicConsentStatus {
  return {
    document,
    version: currentVersion(document),
    granted: row?.action === ConsentAction.GRANTED,
    requiredForGeneration: REQUIRED_GENERATION_CONSENTS.includes(document),
    withdrawable: WITHDRAWABLE_DOCUMENTS.has(document),
    recordedAt: row?.recordedAt.toISOString() ?? null,
  };
}

export async function getConsentStatus(
  userId: string
): Promise<PublicConsentStatus[]> {
  const documents = Object.values(ConsentDocument);
  const rows = await prisma.userConsent.findMany({
    where: {
      userId,
      OR: documents.map((document) => ({
        document,
        documentVersion: currentVersion(document),
      })),
    },
    orderBy: { recordedAt: "desc" },
  });

  return documents.map((document) => {
    const row =
      rows.find(
        (candidate) =>
          candidate.document === document &&
          candidate.documentVersion === currentVersion(document)
      ) ?? null;
    return toPublicStatus(document, row);
  });
}

export async function getMissingGenerationConsents(
  userId: string
): Promise<ConsentDocument[]> {
  const status = await getConsentStatus(userId);
  return status
    .filter((item) => item.requiredForGeneration && !item.granted)
    .map((item) => item.document);
}

export async function recordConsentAction(input: {
  userId: string;
  document: ConsentDocument;
  action: ConsentAction;
  source?: string;
}): Promise<PublicConsentStatus> {
  if (
    input.action === ConsentAction.WITHDRAWN &&
    !WITHDRAWABLE_DOCUMENTS.has(input.document)
  ) {
    throw new ConsentWithdrawalNotAvailableError();
  }

  const version = currentVersion(input.document);
  const latest = await prisma.userConsent.findFirst({
    where: {
      userId: input.userId,
      document: input.document,
      documentVersion: version,
    },
    orderBy: { recordedAt: "desc" },
  });

  /*
   * Repeated UI submissions are idempotent. A different action always appends
   * a new record instead of mutating the earlier legal/audit record.
   */
  const row =
    latest?.action === input.action
      ? latest
      : await prisma.userConsent.create({
          data: {
            userId: input.userId,
            document: input.document,
            documentVersion: version,
            action: input.action,
            source: input.source || "self_service",
          },
        });

  return toPublicStatus(input.document, row);
}

export class ConsentWithdrawalNotAvailableError extends Error {
  constructor() {
    super("This record cannot be withdrawn in self-service.");
    this.name = "ConsentWithdrawalNotAvailableError";
  }
}
