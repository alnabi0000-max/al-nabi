# Staged rollout runbook

This runbook turns the global-video-parity rollout into four explicit
operational decisions: internal alpha, invite-only beta, limited paid regional
availability, and regional global expansion. It complements, and does not
replace, the current [production deployment runbook](./production-deployment.md)
and [staging release verification](./staging-release-e2e.md).

The versioned, credential-free checklist is
`src/lib/rollout/checklist.ts`. It evaluates operator-supplied evidence only:
it does not change traffic, contact a provider, read secrets, or block
application boot. A passing assessment is evidence for a human release
decision, not permission to skip existing release checks.

## Operating rules

- Evaluate one stage, one release version, and one jurisdiction at a time. Do
  not aggregate favorable numbers from different regions or releases.
- Keep the evidence record with its owner, UTC time window, app version,
  jurisdiction, source links, sample counts, and approver. Record only
  request/job/payment IDs and links; never copy prompts, media, auth tokens,
  payment details, or customer PII into the rollout record.
- A stage can only advance after the preceding stage exit was explicitly
  approved. A metric at a promotion threshold is not a waiver for an
  unresolved privacy, billing, moderation, or security incident.
- A daily provider-spend cap and a named incident commander/support owner are
  required before alpha. The budget owner sets the numeric cap outside source
  control and records every cap change with its reason.
- Before every promotion, run the existing repository gates and staging E2E
  flow. The local rollout checker and its tests need no external credentials:

  ```bash
  npm test -- tests/staged-rollout.test.ts
  ```

## KPI definitions

Use a single UTC observation window for all rates in a decision. Retain the
raw export or query reference used to calculate each value.

- **Eligible generation:** a unique server-accepted generation that was billed
  or submitted for provider work. Exclude client-side validation rejects,
  duplicate retries, and user cancellations before work or a charge begins.
- **Delivery success rate:** owner-accessible completed deliveries divided by
  eligible generations. A retried request counts once by its final outcome.
- **Generation credit-refund rate:** eligible generations receiving an
  automatic NC restoration divided by eligible generations. The operational
  verification must show the corresponding ledger entries; do not issue a
  second manual credit for the same generation.
- **Purchase cash-refund rate:** financially refunded paid purchases divided
  by settled paid purchases. This is separate from automatic generation NC
  refunds.
- **Time to first draft:** elapsed minutes from server acceptance to the first
  owner-accessible completed render. Record P50 and P95, not only the average.
- **Approved clips per provider USD:** explicit creator or blinded reviewer
  approvals divided by actual upstream provider spend in USD. Count each clip
  once; no response is not an approval. Do not substitute NC face value or
  list price for upstream cost.
- **P90 first support response:** business minutes from ticket receipt to the
  first meaningful human response. Exclude documented out-of-hours time and
  bot acknowledgements.
- **Moderation appeal rate:** appeals divided by moderation decisions during
  the window. Keep the decision/appeal source separately from the rollout
  record.
- **Deletion completion rate:** physical deletions completed within the
  published deletion SLO divided by deletion requests due in the window. A
  database soft delete does not count while a private object remains.

The current admin analytics surface can supply payment and ledger context.
Generation delivery, provider cost, support, moderation, and deletion metrics
must be exported from their operational systems and linked as evidence until a
dedicated analytics integration exists.

## Promotion criteria

The thresholds below are encoded in
`src/lib/rollout/checklist.ts`; change that policy and this runbook together in
a reviewed pull request.

### 1. Internal alpha

Audience: employees and explicitly authorized testers only; no public link,
marketing, or paid acquisition.

Required evidence:

- The current production release evidence and full staging E2E evidence are
  recorded.
- Signed private-media access, an automatic failed-generation NC refund, and
  physical media deletion have each been verified end to end.
- A named incident commander, support owner, and daily provider-spend cap are
  recorded.
- At least 20 real end-to-end renders across the supported generation paths
  have a delivery, retry/refund, and deletion result recorded.

Exit: the accountable release owner records an alpha-exit approval and any
known limitations. Pause immediately for private-media exposure, duplicate
charges/credits, missing automatic refunds, or an uncontrolled spend cap.

### 2. Invite-only beta

Audience: 25–100 invited creators. Split a cohort above 100 unless capacity,
support, and spend owners explicitly approve the exception.

Required evidence after at least 7 days and 100 eligible generations:

- Alpha exit is approved; fallback behavior, weekly quality review ownership,
  and a reviewed daily spend cap are recorded.
- Delivery success is at least 95%; automatic generation credit refunds are at
  most 5%.
- P50 time to first draft is at most 15 minutes and P95 is at most 60 minutes.
- At least 0.10 explicitly approved clips are produced per provider USD.
- P90 first support response is at most 480 business minutes (one business
  day).

Hold the cohort rather than expanding it if the daily spend cap is reached,
quality review finds a material regression, or any KPI misses its target. The
weekly review should sample successful, failed/refunded, and moderated jobs,
not only creator-selected highlights.

### 3. Limited paid regional rollout

Audience: one payment- and legally-ready jurisdiction; no expansion by IP
geography alone. The regional owner must confirm applicable consumer,
tax/privacy, payment, and support obligations before inviting paying users.

Required evidence after at least 14 days, 25 paid customers, and 250 eligible
generations:

- Beta exit is approved. The jurisdiction decision, payment reconciliation,
  Sentry alert exercise, on-call roster, and authority to approve cash refunds
  are recorded.
- Delivery success is at least 97%; automatic generation credit refunds are at
  most 3%; purchase cash refunds are at most 5%.
- P50/P95 time to first draft are at most 10/45 minutes.
- Approved clips per provider USD are at least 0.10; P90 first support response
  is at most 480 business minutes.
- Moderation appeals are at most 5% of moderation decisions.
- All deletions due in the window complete within the published SLO (100%).

Run daily payment/ledger reconciliation during this phase and hold new paid
availability if it cannot reconcile, if an alert lacks an owner, or if any
private object misses the deletion SLO.

### 4. Global expansion

There is no single global switch. Evaluate the following requirements
independently for each proposed region before enabling it, then re-evaluate
after material provider, payment, moderation, or policy changes.

Required evidence after at least 28 days and 500 eligible generations in that
region:

- Limited paid regional exit is approved. The proposed region has documented
  payment readiness, moderation coverage, support coverage, and deletion-SLO
  validation.
- Delivery success is at least 98%; automatic generation credit refunds and
  purchase cash refunds are each at most 2%.
- P50/P95 time to first draft are at most 8/30 minutes.
- Approved clips per provider USD are at least 0.12; P90 first support response
  is at most 240 business minutes.
- Moderation appeals are at most 3%, and deletion completion within the
  published SLO is 100%.

Regional support coverage means a named owner, communicated support hours,
escalation path, and refund authority appropriate to the locale. Do not mark a
region complete merely because another region met the targets.

## Incident, refund, and support playbooks

### Incident response

1. **Declare and contain.** The incident commander records UTC start time,
   severity, release version, affected region, and a minimal set of opaque IDs.
   For suspected private-media exposure, payment duplication, or active
   security abuse, stop new traffic to the affected cohort/region first and
   preserve logs/evidence.
2. **Classify.** Treat privacy/security exposure or incorrect customer charges
   as P0; broad delivery/refund failure or a payment reconciliation mismatch as
   P1; a degraded non-critical feature as P2. A P0/P1 freezes promotion and
   new cohort expansion until the accountable owner closes it.
3. **Stabilize.** Enforce the provider-spend cap, pause the affected entry
   path when needed, use the existing idempotent retry/refund behavior, and
   avoid repeated manual retries that can double charge or double refund.
4. **Communicate.** Acknowledge affected beta users and support within the
   phase SLA; provide a factual status, workaround, next update time, and
   refund path. Do not promise a restoration time before one is evidenced.
5. **Recover and review.** Reconcile affected generations, ledger entries,
   purchases, and physical objects. Record root cause, customer impact,
   refunds, corrective owner/date, and a weekly incident review decision before
   resuming expansion.

### Refund handling

- A failed charged generation is handled as an NC restoration through the
  existing idempotent generation refund path. Verify one generation ID maps to
  no more than one rollback before a manual adjustment.
- For a payment issue, collect account email, Stripe Checkout/session or
  receipt ID, purchase time, pack, region, and reason in the billing system.
  Do not ask customers to send card data.
- The named refund authority checks payment settlement, purchase status, NC
  delivery, ledger history, and previous refunds before approving a card
  refund. Follow the published [Refund Policy](/refund-policy): requests are
  generally made within 14 days, an initial response is normally within five
  business days, and approved card refunds go to the original payment method.
- Log the outcome and reason with the incident/ticket ID, then include it in
  purchase cash-refund KPI reporting. A refund does not close a security,
  reconciliation, or deletion incident by itself.

### Support handling

- Publish one intake route per region and route billing/NC questions to the
  billing owner. Maintain an on-call escalation path for P0/P1 issues.
- Each ticket should capture the requester account email, region, approximate
  time, opaque generation/job or receipt ID, issue type, and safe reproduction
  summary. Remove media, prompts, tokens, and payment details from handoffs.
- Tag tickets as access/privacy, payment/refund, generation/delivery,
  moderation, or product guidance. Access/privacy and payment duplication
  issues go directly to the incident commander/refund authority.
- Measure the P90 first meaningful human response in business minutes every
  week. Missing the phase target freezes promotion until staffing or routing is
  corrected and a fresh observation window meets the target.

## Evidence record and decision

The evaluator accepts an object with reviewed controls and numeric metrics.
Rates must use decimals (`0.97`, not `97`). The test suite verifies that
missing controls, missing metrics, invalid percentages, and an oversized beta
cohort cannot be silently treated as ready.

```ts
import { evaluateRolloutStage } from "@/lib/rollout/checklist";

const assessment = evaluateRolloutStage("invite_beta", {
  controls: {
    internalAlphaExitApproved: true,
    providerFallbackValidated: true,
    weeklyQualityReviewAssigned: true,
    dailySpendCapReviewed: true,
  },
  metrics: {
    observationDays: 7,
    invitedCreators: 40,
    eligibleGenerations: 120,
    deliverySuccessRate: 0.96,
    generationRefundRate: 0.03,
    p50DraftMinutes: 12,
    p95DraftMinutes: 48,
    approvedClipsPerProviderUsd: 0.11,
    p90SupportFirstResponseBusinessMinutes: 360,
  },
});
```

An approval record must attach this assessment, the raw metric sources, the
daily spend-cap decision, incident/reconciliation status, and the names of the
release owner plus the next-phase owners. If `ready` is false, the listed
blockers are the remediation checklist; warnings require an explicit recorded
decision before expansion.
