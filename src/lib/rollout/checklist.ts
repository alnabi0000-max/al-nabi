/**
 * Read-only evidence evaluator for the staged rollout runbook.
 *
 * This intentionally does not read environment variables, contact providers,
 * change traffic, or block application boot. Operators supply reviewed
 * evidence after the existing release checks and staging E2E run.
 */

export const ROLLOUT_STAGES = [
  "internal_alpha",
  "invite_beta",
  "paid_regional",
  "global",
] as const;

export type RolloutStage = (typeof ROLLOUT_STAGES)[number];

export const ROLLOUT_CONTROLS = [
  "releaseReadinessRecorded",
  "stagingE2eRecorded",
  "privateMediaValidated",
  "generationRefundValidated",
  "deletionValidated",
  "incidentCommanderAssigned",
  "supportOwnerAssigned",
  "providerSpendCapConfigured",
  "internalAlphaExitApproved",
  "providerFallbackValidated",
  "weeklyQualityReviewAssigned",
  "dailySpendCapReviewed",
  "inviteBetaExitApproved",
  "jurisdictionApproved",
  "paymentReconciliationValidated",
  "sentryAlertsValidated",
  "onCallRosterAssigned",
  "refundAuthorityAssigned",
  "paidRegionalExitApproved",
  "regionalPaymentReadinessValidated",
  "regionalModerationCoverageValidated",
  "regionalSupportCoverageValidated",
  "regionalDeletionSloValidated",
] as const;

export type RolloutControl = (typeof ROLLOUT_CONTROLS)[number];

export const ROLLOUT_METRICS = [
  "e2eRenders",
  "observationDays",
  "invitedCreators",
  "paidCustomers",
  "eligibleGenerations",
  "deliverySuccessRate",
  "generationRefundRate",
  "purchaseRefundRate",
  "p50DraftMinutes",
  "p95DraftMinutes",
  "approvedClipsPerProviderUsd",
  "p90SupportFirstResponseBusinessMinutes",
  "moderationAppealRate",
  "deletionCompletionRate",
] as const;

export type RolloutMetric = (typeof ROLLOUT_METRICS)[number];

export type RolloutEvidence = {
  /** Human-reviewed operational evidence; a missing value is never assumed true. */
  controls: Partial<Record<RolloutControl, boolean>>;
  /**
   * Measurements for one phase and one region. Rates are decimals from 0 to 1,
   * while time values are minutes and approved clips per provider USD is a ratio.
   */
  metrics: Partial<Record<RolloutMetric, number>>;
};

type MetricRequirement = {
  metric: RolloutMetric;
  comparison: "at_least" | "at_most";
  value: number;
  label: string;
};

export type RolloutStageGate = {
  title: string;
  controls: readonly RolloutControl[];
  metrics: readonly MetricRequirement[];
};

const RATE_METRICS = new Set<RolloutMetric>([
  "deliverySuccessRate",
  "generationRefundRate",
  "purchaseRefundRate",
  "moderationAppealRate",
  "deletionCompletionRate",
]);

const METRIC_LABELS: Record<RolloutMetric, string> = {
  e2eRenders: "real end-to-end renders",
  observationDays: "observation days",
  invitedCreators: "invited creators",
  paidCustomers: "paid customers",
  eligibleGenerations: "eligible generations",
  deliverySuccessRate: "delivery success rate",
  generationRefundRate: "generation credit-refund rate",
  purchaseRefundRate: "purchase cash-refund rate",
  p50DraftMinutes: "P50 time to first draft (minutes)",
  p95DraftMinutes: "P95 time to first draft (minutes)",
  approvedClipsPerProviderUsd: "approved clips per provider USD",
  p90SupportFirstResponseBusinessMinutes:
    "P90 first support response (business minutes)",
  moderationAppealRate: "moderation appeal rate",
  deletionCompletionRate: "deletion completion rate within the published SLO",
};

function atLeast(
  metric: RolloutMetric,
  value: number,
  label = METRIC_LABELS[metric]
): MetricRequirement {
  return { metric, comparison: "at_least", value, label };
}

function atMost(
  metric: RolloutMetric,
  value: number,
  label = METRIC_LABELS[metric]
): MetricRequirement {
  return { metric, comparison: "at_most", value, label };
}

/**
 * Versioned promotion criteria. Global assessments must be run per proposed
 * region rather than against a blended cross-region aggregate.
 */
export const ROLLOUT_STAGE_GATES: Readonly<
  Record<RolloutStage, RolloutStageGate>
> = {
  internal_alpha: {
    title: "Internal alpha",
    controls: [
      "releaseReadinessRecorded",
      "stagingE2eRecorded",
      "privateMediaValidated",
      "generationRefundValidated",
      "deletionValidated",
      "incidentCommanderAssigned",
      "supportOwnerAssigned",
      "providerSpendCapConfigured",
    ],
    metrics: [atLeast("e2eRenders", 20)],
  },
  invite_beta: {
    title: "Invite-only beta",
    controls: [
      "internalAlphaExitApproved",
      "providerFallbackValidated",
      "weeklyQualityReviewAssigned",
      "dailySpendCapReviewed",
    ],
    metrics: [
      atLeast("observationDays", 7),
      atLeast("invitedCreators", 25),
      atLeast("eligibleGenerations", 100),
      atLeast("deliverySuccessRate", 0.95),
      atMost("generationRefundRate", 0.05),
      atMost("p50DraftMinutes", 15),
      atMost("p95DraftMinutes", 60),
      atLeast("approvedClipsPerProviderUsd", 0.1),
      atMost("p90SupportFirstResponseBusinessMinutes", 480),
    ],
  },
  paid_regional: {
    title: "Limited paid regional rollout",
    controls: [
      "inviteBetaExitApproved",
      "jurisdictionApproved",
      "paymentReconciliationValidated",
      "sentryAlertsValidated",
      "onCallRosterAssigned",
      "refundAuthorityAssigned",
    ],
    metrics: [
      atLeast("observationDays", 14),
      atLeast("paidCustomers", 25),
      atLeast("eligibleGenerations", 250),
      atLeast("deliverySuccessRate", 0.97),
      atMost("generationRefundRate", 0.03),
      atMost("purchaseRefundRate", 0.05),
      atMost("p50DraftMinutes", 10),
      atMost("p95DraftMinutes", 45),
      atLeast("approvedClipsPerProviderUsd", 0.1),
      atMost("p90SupportFirstResponseBusinessMinutes", 480),
      atMost("moderationAppealRate", 0.05),
      atLeast("deletionCompletionRate", 1),
    ],
  },
  global: {
    title: "Global expansion",
    controls: [
      "paidRegionalExitApproved",
      "jurisdictionApproved",
      "regionalPaymentReadinessValidated",
      "regionalModerationCoverageValidated",
      "regionalSupportCoverageValidated",
      "regionalDeletionSloValidated",
    ],
    metrics: [
      atLeast("observationDays", 28),
      atLeast("eligibleGenerations", 500),
      atLeast("deliverySuccessRate", 0.98),
      atMost("generationRefundRate", 0.02),
      atMost("purchaseRefundRate", 0.02),
      atMost("p50DraftMinutes", 8),
      atMost("p95DraftMinutes", 30),
      atLeast("approvedClipsPerProviderUsd", 0.12),
      atMost("p90SupportFirstResponseBusinessMinutes", 240),
      atMost("moderationAppealRate", 0.03),
      atLeast("deletionCompletionRate", 1),
    ],
  },
};

export type RolloutAssessment = {
  stage: RolloutStage;
  ready: boolean;
  blockers: string[];
  warnings: string[];
};

function formatMetricValue(metric: RolloutMetric, value: number): string {
  if (RATE_METRICS.has(metric)) return `${Math.round(value * 100)}%`;
  if (metric === "approvedClipsPerProviderUsd") return value.toFixed(2);
  return String(value);
}

/**
 * Evaluates supplied evidence only. A passing result is an operational
 * decision aid, not an automated production release or traffic-control gate.
 */
export function evaluateRolloutStage(
  stage: RolloutStage,
  evidence: RolloutEvidence
): RolloutAssessment {
  const gate = ROLLOUT_STAGE_GATES[stage];
  const blockers: string[] = [];
  const warnings: string[] = [];

  for (const control of gate.controls) {
    if (evidence.controls[control] !== true) {
      blockers.push(`Record and approve control: ${control}.`);
    }
  }

  for (const requirement of gate.metrics) {
    const actual = evidence.metrics[requirement.metric];
    if (actual == null || !Number.isFinite(actual)) {
      blockers.push(`Record ${requirement.label}.`);
      continue;
    }

    if (RATE_METRICS.has(requirement.metric) && (actual < 0 || actual > 1)) {
      blockers.push(
        `${requirement.label} must be a decimal between 0 and 1, not ${actual}.`
      );
      continue;
    }

    const passes =
      requirement.comparison === "at_least"
        ? actual >= requirement.value
        : actual <= requirement.value;
    if (!passes) {
      const operator = requirement.comparison === "at_least" ? "at least" : "at most";
      blockers.push(
        `${requirement.label} must be ${operator} ${formatMetricValue(
          requirement.metric,
          requirement.value
        )}; observed ${formatMetricValue(requirement.metric, actual)}.`
      );
    }
  }

  if (
    stage === "invite_beta" &&
    (evidence.metrics.invitedCreators ?? 0) > 100
  ) {
    warnings.push(
      "Invite cohort exceeds 100 creators; split the cohort or record an explicit capacity decision."
    );
  }

  return {
    stage,
    ready: blockers.length === 0,
    blockers,
    warnings,
  };
}
