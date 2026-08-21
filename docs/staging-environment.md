# Staging environment preparation

This is a redacted release manifest, not an `.env` file to commit or copy to a
workstation. Set the named values only in the staging target's encrypted secret
store. The release runner may report whether each check passed, but must never
print values.

## Ordered setup

1. Provision an isolated staging domain, database, Supabase project, Stripe
   test-mode account/webhook, private storage bucket, and observability/email
   projects. Confirm none are production resources.
2. Obtain a database backup/restore drill reference and assign one release job
   as the only migration owner.
3. Enter the required variables below in the staging platform's encrypted
   secret store. Do not create an untracked `.env.staging` file on a shared
   machine.
4. Run `npm run launch:check -- --json` in the secure release environment. A
   failed check is a release blocker; do not start the app or apply migrations.
5. After the staging target is confirmed, run the target-bound sequence in
   [staging release verification](./staging-release-e2e.md), then record every
   smoke-flow result.

## Redacted variable manifest

```dotenv
# Runtime and routing
AUTH_MODE=supabase
NEXT_PUBLIC_APP_URL=
AUTH_SECRET=

# Postgres
DATABASE_URL=
DIRECT_URL=

# Supabase authentication
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Stripe: use staging/test-mode credentials and webhook endpoint
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# AI providers and background work
OPENROUTER_API_KEY=
REPLICATE_API_KEY=
ELEVENLABS_API_KEY=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Choose exactly one private persistent-storage provider
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
# OR
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=

# Rate limiting and operational route protection
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ADMIN_API_SECRET=
CRON_SECRET=
ALNABIY_OBFUSCATE_SECRET=

# Explicit staging trust/safety policy
SAFETY_FAIL_CLOSED=1
SAFETY_REFERENCE_MEDIA_MODE=review

# Required staging verification integrations
NEXT_PUBLIC_SENTRY_DSN=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

The preflight validates presence and safe shape only. It cannot validate
provider permissions, bucket policy, webhook delivery, DNS, OAuth redirects,
email-domain verification, or a credential's authority. Those are mandatory
staging E2E checks. `npm run launch:check -- --json` also emits `missingEnv`:
the variable names to set or remove, never values.

## Runtime pin

Staging and production must run Node `22.13.x` (see `.nvmrc` and
`package.json` `engines`). A local laptop on Node 23+ can prepare secrets, but
`npm run start` and the launch preflight will refuse that runtime.

## Operator-created accounts

These cannot be generated in the repository. Create isolated staging projects
and paste the values only into the staging secret store:

1. Upstash Redis REST — `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
   (https://console.upstash.com)
2. Sentry browser DSN — `NEXT_PUBLIC_SENTRY_DSN` (https://sentry.io)
3. Resend API and from-address — `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
   (https://resend.com/api-keys)

Operational secrets (`ADMIN_API_SECRET`, `CRON_SECRET`,
`ALNABIY_OBFUSCATE_SECRET`) and the safety flags may be generated locally and
copied into the same secret store. Do not reuse production values.

Vercel cron already invokes `/api/cron/model-watch` every 12 hours and
`/api/cron/billing-reconcile` daily at 04:15 UTC. Both require `CRON_SECRET`.

## Conditional settings

- `SUPABASE_SERVICE_ROLE_KEY` is needed for the server-side Supabase admin
  helper used by password-registration and user-confirmation flows.
- `SUPABASE_WEBHOOK_SECRET` is required when the Supabase auth-user webhook is
  enabled. An unset production webhook endpoint fails closed with `503`.
- `SUPABASE_JWT_SECRET` is optional defense in depth for Edge bearer-token
  verification.
- `BILLING_WEBHOOK_PROCESSING_TIMEOUT_SEC`,
  `PRIVACY_BILLING_RETENTION_DAYS`, and `ALLOW_FREE_GENERATIONS` require a
  reviewed billing/privacy decision before use.
- `ALNABIY_FFMPEG_ENABLED=1` belongs only on a staging worker with the required
  FFmpeg capabilities; confirm that worker through the export E2E flow.

## Forbidden staging release settings

Do not configure `R2_PUBLIC_URL`, `AWS_S3_PUBLIC_URL`, or `S3_PUBLIC_URL`.
The storage bucket must deny public reads, and application delivery must use
owner-authorized signed URLs only.

Do not enable `ALNABIY_DEV_AUTH_BYPASS`, `ALLOW_DEMO_CHECKOUT`,
`ALLOW_SOFT_CREDITS`, `ALNABIY_FORCE_MOCK`, `ALNABIY_ALLOW_AUDIO_MOCK`, or
`NEXT_PUBLIC_AUTH_MODE=local`. The launch preflight rejects enabled bypasses
and a public media base URL.
