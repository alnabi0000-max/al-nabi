import { assertGenerationEntitlement } from "@/lib/billing/entitlements";
import { getMissingGenerationConsents } from "@/lib/trust/consent";
import { evaluateAndAuditSafety } from "@/lib/trust/safety";

export type GenerationTrustFailure = {
  code:
    | "CONSENT_REQUIRED"
    | "SAFETY_BLOCKED"
    | "SAFETY_REVIEW_REQUIRED"
    | "SAFETY_UNAVAILABLE"
    | "ENTITLEMENT_REQUIRED"
    | "TRUST_UNAVAILABLE";
  message: string;
  missingConsents?: string[];
};

/**
 * Shared ordering for paid media requests:
 * identity -> consent -> safety audit -> durable entitlement -> wallet/provider.
 * Callers must invoke this before a preflight charge, enqueue, or provider call.
 */
export async function enforceGenerationTrust(input: {
  userId: string;
  surface: string;
  text: string;
  hasReferenceMedia?: boolean;
}): Promise<GenerationTrustFailure | null> {
  try {
    const missing = await getMissingGenerationConsents(input.userId);
    if (missing.length > 0) {
      return {
        code: "CONSENT_REQUIRED",
        message:
          "Review and accept the required terms, privacy, and AI media processing notices before continuing.",
        missingConsents: missing,
      };
    }

    const safety = await evaluateAndAuditSafety(input);
    if (safety) {
      return {
        code: safety.code,
        message: safety.message,
      };
    }

    const entitlement = await assertGenerationEntitlement(input.userId);
    if (!entitlement.allowed) {
      return {
        code: "ENTITLEMENT_REQUIRED",
        message: "An active entitlement is required for this feature.",
      };
    }
    return null;
  } catch {
    /*
     * Do not let an unavailable governance database silently become a policy
     * bypass. This is deliberately a generic user-facing error.
     */
    return {
      code: "TRUST_UNAVAILABLE",
      message: "Account trust checks are temporarily unavailable. Please try again later.",
    };
  }
}
