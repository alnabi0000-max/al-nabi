import { describe, expect, it } from "vitest";
import {
  evaluateRolloutStage,
  ROLLOUT_STAGE_GATES,
  type RolloutEvidence,
  type RolloutStage,
} from "@/lib/rollout/checklist";

function passingEvidence(stage: RolloutStage): RolloutEvidence {
  const gate = ROLLOUT_STAGE_GATES[stage];
  const evidence: RolloutEvidence = { controls: {}, metrics: {} };

  for (const control of gate.controls) {
    evidence.controls[control] = true;
  }
  for (const metric of gate.metrics) {
    evidence.metrics[metric.metric] = metric.value;
  }

  return evidence;
}

describe("staged rollout checklist", () => {
  it("keeps internal alpha blocked until its operational evidence is recorded", () => {
    const assessment = evaluateRolloutStage("internal_alpha", {
      controls: {},
      metrics: { e2eRenders: 20 },
    });

    expect(assessment.ready).toBe(false);
    expect(assessment.blockers).toContain(
      "Record and approve control: stagingE2eRecorded."
    );
  });

  it("accepts invite beta evidence at every documented threshold", () => {
    const assessment = evaluateRolloutStage(
      "invite_beta",
      passingEvidence("invite_beta")
    );

    expect(assessment).toMatchObject({
      ready: true,
      blockers: [],
      warnings: [],
    });
  });

  it("requires the stricter paid rollout controls and deletion SLO", () => {
    const evidence = passingEvidence("paid_regional");
    evidence.controls.onCallRosterAssigned = false;
    evidence.metrics.deletionCompletionRate = 0.99;

    const assessment = evaluateRolloutStage("paid_regional", evidence);

    expect(assessment.ready).toBe(false);
    expect(assessment.blockers).toContain(
      "Record and approve control: onCallRosterAssigned."
    );
    expect(assessment.blockers.some((blocker) => blocker.includes("deletion completion"))).toBe(
      true
    );
  });

  it("rejects percentage inputs outside the documented decimal range", () => {
    const evidence = passingEvidence("global");
    evidence.metrics.deliverySuccessRate = 98;

    const assessment = evaluateRolloutStage("global", evidence);

    expect(assessment.ready).toBe(false);
    expect(assessment.blockers).toContain(
      "delivery success rate must be a decimal between 0 and 1, not 98."
    );
  });

  it("flags invite cohorts that exceed the 25–100 creator rollout band", () => {
    const evidence = passingEvidence("invite_beta");
    evidence.metrics.invitedCreators = 101;

    const assessment = evaluateRolloutStage("invite_beta", evidence);

    expect(assessment.ready).toBe(true);
    expect(assessment.warnings).toHaveLength(1);
  });
});
