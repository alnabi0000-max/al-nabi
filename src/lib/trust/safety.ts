import { createHash } from "crypto";
import { SafetyOutcome } from "@prisma/client";
import { moderateText } from "@/lib/security/moderation";
import { AlnabiySentinelEngine } from "@/lib/sentinel-engine";
import { prisma } from "@/lib/prisma";

export const SAFETY_POLICY_VERSION = "2026-08-20";

export type SafetyDecision = {
  outcome: SafetyOutcome;
  code:
    | "SAFETY_BLOCKED"
    | "SAFETY_REVIEW_REQUIRED"
    | "SAFETY_UNAVAILABLE";
  message: string;
  evaluator: string;
  coverage: string;
};

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function failClosed(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.SAFETY_FAIL_CLOSED === "1"
  );
}

function referenceMediaOutcome(): SafetyOutcome {
  return process.env.SAFETY_REFERENCE_MEDIA_MODE === "block"
    ? SafetyOutcome.BLOCK
    : SafetyOutcome.REVIEW;
}

function publicDecision(
  outcome: SafetyOutcome,
  evaluator: string,
  coverage: string
): SafetyDecision | null {
  switch (outcome) {
    case SafetyOutcome.ALLOW:
      return null;
    case SafetyOutcome.BLOCK:
      return {
        outcome,
        code: "SAFETY_BLOCKED",
        message: "This request cannot be processed under our safety rules.",
        evaluator,
        coverage,
      };
    case SafetyOutcome.REVIEW:
      return {
        outcome,
        code: "SAFETY_REVIEW_REQUIRED",
        message: "This request needs review before it can be processed.",
        evaluator,
        coverage,
      };
    case SafetyOutcome.UNAVAILABLE:
      return {
        outcome,
        code: "SAFETY_UNAVAILABLE",
        message: "Safety checks are temporarily unavailable. Please try again later.",
        evaluator,
        coverage,
      };
  }
}

async function persistAudit(input: {
  userId: string;
  surface: string;
  outcome: SafetyOutcome;
  text: string;
  referenceMedia: boolean;
  evaluator: string;
  coverage: string;
}): Promise<boolean> {
  try {
    await prisma.safetyAudit.create({
      data: {
        userId: input.userId,
        surface: input.surface,
        policyVersion: SAFETY_POLICY_VERSION,
        outcome: input.outcome,
        inputDigest: digest(input.text),
        referenceMedia: input.referenceMedia,
        evaluator: input.evaluator,
        coverage: input.coverage,
      },
    });
    return true;
  } catch {
    /*
     * Avoid logging user text or media URLs. Production requests must not move
     * ahead without the immutable audit row; local/test remains operable.
     */
    return false;
  }
}

/**
 * Performs a conservative, server-side policy gate and appends a minimized,
 * immutable audit row before provider queueing or wallet charging.
 *
 * This is not a claim that arbitrary reference media is fully automatedly
 * classified: unassessed media is held for review (or blocked by config).
 */
export async function evaluateAndAuditSafety(input: {
  userId: string;
  surface: string;
  text: string;
  hasReferenceMedia?: boolean;
}): Promise<SafetyDecision | null> {
  const referenceMedia = Boolean(input.hasReferenceMedia);
  const sentinel = AlnabiySentinelEngine.processInput(input.text);
  let outcome: SafetyOutcome = SafetyOutcome.ALLOW;
  let evaluator = "sentinel+moderation";
  let coverage = "text_policy_screening";

  if (!sentinel.isSafe) {
    outcome = SafetyOutcome.BLOCK;
    evaluator = "sentinel";
    coverage = "deterministic_text_policy";
  } else {
    const moderation = await moderateText(input.text);
    if (!moderation.allowed) {
      outcome =
        moderation.provider === "unavailable"
          ? SafetyOutcome.UNAVAILABLE
          : SafetyOutcome.BLOCK;
      evaluator = moderation.provider;
      coverage =
        moderation.provider === "unavailable"
          ? "policy_evaluation_unavailable"
          : "text_policy_screening";
    } else if (moderation.provider === "skipped" && failClosed()) {
      outcome = SafetyOutcome.UNAVAILABLE;
      evaluator = "unavailable";
      coverage = "policy_evaluation_unavailable";
    } else if (referenceMedia) {
      outcome = referenceMediaOutcome();
      evaluator =
        moderation.provider === "skipped"
          ? "sentinel"
          : `${moderation.provider}+reference_hold`;
      coverage = "reference_media_unassessed";
    } else if (moderation.provider === "skipped") {
      evaluator = "sentinel";
      coverage = "development_static_policy_only";
    }
  }

  const auditRecorded = await persistAudit({
    ...input,
    outcome,
    referenceMedia,
    evaluator,
    coverage,
  });
  if (!auditRecorded && failClosed()) {
    return publicDecision(
      SafetyOutcome.UNAVAILABLE,
      "audit_unavailable",
      "audit_persistence_required"
    );
  }

  return publicDecision(outcome, evaluator, coverage);
}
