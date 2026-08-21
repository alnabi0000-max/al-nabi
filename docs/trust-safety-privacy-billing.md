# Trust, safety, privacy, and billing operations

This runbook covers the Phase 4 governance controls. It supplements the
[production deployment runbook](./production-deployment.md); it does not make
an automated moderation result, an erasure request, or a reconciliation result
a legal conclusion.

## Apply the migration

This release adds:

```text
20260820230000_global_trust_billing
```

Use the normal production procedure only:

```bash
npm run db:deploy
npx prisma migrate status
```

Take a verified backup first. The migration is additive: it creates consent,
safety audit, privacy request, subscription, entitlement, webhook-event, and
reconciliation tables. Do not use `db push` in production.

Run these target-bound commands only after the staging target and its encrypted
configuration have passed `npm run launch:check -- --json`. This migration
follows the Phase 2 project and Phase 3 timeline/export migrations; the full
source-controlled order is maintained in the
[production deployment runbook](./production-deployment.md).

## Required configuration

Set values in the deployment secret store, never in a committed `.env` file.

| Setting | Production expectation |
| --- | --- |
| `STRIPE_SECRET_KEY` | Required to accept Stripe webhooks. |
| `STRIPE_WEBHOOK_SECRET` | Required with `STRIPE_SECRET_KEY`; unsigned events are rejected. |
| `CRON_SECRET` | Required to invoke the billing reconciler. Use an `Authorization: Bearer` header only. |
| `BILLING_WEBHOOK_PROCESSING_TIMEOUT_SEC` | Optional 30–3600 second stale-event reclaim threshold; defaults to 300. |
| `OPENROUTER_API_KEY` | Required for configured automated text moderation. |
| `SAFETY_FAIL_CLOSED=1` | Recommended in every production-like environment. Production fails closed regardless. |
| `SAFETY_REFERENCE_MEDIA_MODE=review` | Default. Unassessed reference media is held for review; use `block` to reject instead. Do not configure `allow` as a substitute for a media classifier. |
| `PRIVACY_ERASURE_HOLD=1` | Emergency/operator legal retention hold for all account erasure requests. |
| `PRIVACY_BILLING_RETENTION_DAYS=<days>` | Holds erasure when a paid purchase is newer than this window. Set only after legal/tax review. |
| `ALLOW_FREE_GENERATIONS=0` | Enables a subscription/entitlement-only generation policy. Leave unset or `1` to preserve configured free usage. |
| `R2_*` or `AWS_*` / `S3_BUCKET` | Required for production private-media deletion and delivery. |

`STRIPE_SECRET_KEY` without `STRIPE_WEBHOOK_SECRET` is a configuration error:
the webhook returns `503 BILLING_CONFIGURATION_REQUIRED` and never grants
credits or entitlements. The application does not collect card details.

## Consent and safety

- Consent actions are append-only by document version. A new published version
  requires a new affirmative action before generation. Never edit historic
  consent rows to simulate a withdrawal.
- Terms and Privacy acceptance are retained legal records. Users can withdraw
  AI media processing (which blocks future processing) and optional product
  improvement consent through the account surface.
- Every policy decision writes a minimized audit record before queueing or
  charging: account ID, outcome, evaluator/coverage, surface, policy version,
  timestamp, and SHA-256 input digest. Prompts, scripts, URLs, media bytes,
  model payloads, and internal policy categories must not be copied into logs.
- `ALLOW` means the configured text checks permitted the request. It is not a
  guarantee of legal compliance or a claim that all media has been
  automatically classified. `REVIEW` means no provider work or charge occurs;
  `BLOCK` means the request is rejected; `UNAVAILABLE` fails closed where
  configured.
- Before changing policy versions, test a representative, non-sensitive
  fixture set in staging. Record only opaque IDs and aggregate outcomes.

## Privacy export and erasure

Authenticated owners use the Account trust, safety & privacy panel:

1. **Download account export** returns a scoped JSON response directly to the
   authenticated session and records a completed export request.
2. The export intentionally excludes signed URLs, object keys, and private
   media delivery capability. It includes account, consent, project,
   generation, purchase, ledger, and minimized audit records.
3. **Account erasure** requires the exact confirmation phrase `ERASE MY
   ACCOUNT`. A request is created before work begins.
4. A request with a legal/billing hold remains `HELD`; it is not reported as
   erased. A storage/database failure remains `FAILED`; investigate and retry
   through a reviewed operational repair, never by merely changing the status.
5. When eligible, the service removes each known private object through the
   existing object-storage delete primitive before deleting project/generation
   data. It then tombstones account identifiers and disables the account while
   retaining minimum financial and historic governance records.

Before releasing this flow, conduct a staging test with a dedicated account:
verify that every object has disappeared from the private bucket, project and
generation rows are gone, the account is disabled/tombstoned, and the request
is `COMPLETED`. Test a retention hold separately and verify it stays `HELD`.

External payment-processor records and legal retention rules require an
operator process outside this repository. Do not claim those records are
deleted unless the processor procedure is completed and evidenced.

## Billing webhooks and reconciliation

Stripe is currently the implemented billing adapter behind provider-neutral
tables. Each signature-verified Stripe event is claimed by
`(provider, provider_event_id)` before processing. Retries return a duplicate
or in-progress acknowledgement and cannot grant a second purchase credit or
subscription entitlement.

Schedule the reconciler at least daily during paid rollout and after any
webhook incident:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $CRON_SECRET" \
  -X POST https://<app-domain>/api/cron/billing-reconcile
```

The reconciler only creates/updates `OPEN` mismatch records. It does **not**
modify balances, reconstruct a missing ledger entry, grant an entitlement, or
silently resolve a discrepancy. Investigate every finding with the opaque
purchase, subscription, entitlement, and webhook-event IDs:

- `PAID_PURCHASE_MISSING_LEDGER`
- `ACTIVE_SUBSCRIPTION_MISSING_ENTITLEMENT`
- `ENTITLEMENT_WITH_INACTIVE_SUBSCRIPTION`
- `PROCESSED_BILLING_EVENT_UNLINKED`
- `PROCESSING_BILLING_EVENT_STALE`

Use a reviewed, idempotent repair procedure approved by the billing owner.
Never alter a wallet balance from the browser or accept a webhook without a
valid Stripe signature.
