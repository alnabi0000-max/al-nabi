# Production deployment runbook

This runbook covers the release mechanics owned by this repository. It does
not replace the final staging end-to-end verification of authentication,
payments, generation, storage, rate limiting, and moderation.

## Release gates

Use Node `22.13.x` from `.nvmrc` (the supported range is also declared in
`package.json`) and npm 10 or newer. Do not run staging or production builds
on Node 23+. A change is eligible for deployment only after the pull request
workflow succeeds:

```bash
npm ci
npm run ci
```

`npm run ci` runs ESLint with zero warnings, TypeScript checking, focused unit
tests, and the production build. It deliberately does not need production
credentials or a live database.

Before building a deployable staging artifact, run the redacted configuration
preflight in the release environment that receives the **staging** secret set:

```bash
npm run launch:check -- --json
```

It reports only check IDs, pass/fail state, and remediation hints—never values.
Do not point this command at production while staging is being prepared. The
full variable manifest and ordering are in
[staging environment preparation](./staging-environment.md).

Run the production dependency audit in the release job too:

```bash
npm audit --omit=dev --audit-level=high
```

High-severity findings block release unless an approved, time-bounded exception
names the affected package, mitigation, owner, and expiry. Do not combine a
Next.js major upgrade with an unrelated release: it is a separate dependency
gate that requires a dedicated branch, clean Linux CI, migration smoke test,
and staging authentication/payment/media end-to-end verification.

## Production configuration preflight

Set all values in the deployment platform's encrypted secret store; never
paste a production `.env` file into source control or CI logs. Before enabling
traffic, have the security/operations owner verify the production validation
for:

- `DATABASE_URL` (pooled runtime connection) and `DIRECT_URL` (direct
  migration connection).
- Supabase URL, anon key, service-role key where used, `AUTH_MODE=supabase`,
  and a random 32+ character `AUTH_SECRET`.
- Supabase Auth providers: Google and Apple enabled (Apple is required for iOS
  App Store review), plus the email provider with `{{ .Token }}` in the Magic
  Link template so the 6-digit code flow can deliver a code. Redirect URLs must
  list `https://<domain>/auth/callback` and the native `alnabi://auth/callback`
  deep link.
- Optional `SUPABASE_JWT_SECRET`: lets the Edge middleware reject forged bearer
  tokens before they reach a route handler. Without it the middleware still
  enforces token expiry and every route still verifies the token against
  Supabase Auth.
- Stripe secret and webhook signing secret.
- OpenRouter, Replicate, Inngest, Upstash, and a complete R2 or S3 credential
  set. The media bucket must block anonymous/public reads and the application
  must not use `R2_PUBLIC_URL`, `AWS_S3_PUBLIC_URL`, or `S3_PUBLIC_URL` for
  generated media. Media is delivered only through owner-authorized signed
  URLs. Configure and record a bucket lifecycle policy for the approved media
  retention window and incomplete/orphaned upload cleanup; the repository
  cannot create or validate that provider-side policy.
- `ADMIN_API_SECRET`, `CRON_SECRET`, and `ALNABIY_OBFUSCATE_SECRET`. Inngest
  runs the model watch every 12 hours. Vercel cron calls only
  `/api/cron/billing-reconcile` daily, using `CRON_SECRET`.
- `SAFETY_FAIL_CLOSED=1` and `SAFETY_REFERENCE_MEDIA_MODE=review` or `block`.
  Production fails closed independently, but staging must set the intent
  explicitly. Do not configure `allow`.
- `NEXT_PUBLIC_SENTRY_DSN`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` for the
  required staging alert and transactional-email verification.
- No local/demo/mock/bypass flags, including `AUTH_MODE=local`,
  `ALNABIY_DEV_AUTH_BYPASS`, `ALLOW_DEMO_CHECKOUT`, `ALLOW_SOFT_CREDITS`,
  `ALNABIY_FORCE_MOCK`, `ALNABIY_ALLOW_AUDIO_MOCK`, or
  `NEXT_PUBLIC_AUTH_MODE=local`.

Provision FFmpeg-dependent work on its dedicated worker/self-hosted runtime;
do not assume a serverless deployment supplies FFmpeg.

## Prisma migration procedure

`prisma/migrations/20260816141000_initial_schema` is the source-controlled
baseline for a new database. Production must use `npm run db:deploy`; do not
use `db:push:local` or `db:migrate` against production.

Prisma must apply the tracked migrations exactly in directory order. The
current release sequence is:

1. `20260816141000_initial_schema`
2. `20260816160000_auth_role_provider`
3. `20260816193000_admin_settings`
4. `20260820214500_phase2_provider_projects`
5. `20260820221500_project_timeline_exports`
6. `20260820230000_global_trust_billing`

Never invoke an individual migration, reorder these directories, or mark a
later migration as applied before its predecessors. A new database receives
the full sequence through one `npm run db:deploy` invocation.

### New production database

1. Take and retain an empty-database provisioning record.
2. Set `DATABASE_URL` and `DIRECT_URL` to the new database.
3. Run `npm run db:deploy` exactly once from the release job.
4. Run `npx prisma migrate status` and retain the successful output with the
   release record.

### Existing database created with `db push`

Do not run the initial migration directly against an existing database: its
tables and enums already exist. Pause writes, take a verified backup, then:

1. If the old `PlanType` enum includes `HOLLYWOOD`, `DIRECTOR`, or `INFINITE`,
   apply `prisma/sql/remap-plan-types.sql` with `psql "$DIRECT_URL" -f
   prisma/sql/remap-plan-types.sql`.
2. Confirm that the existing database matches the current schema before
   baselining:

   ```bash
   npx prisma migrate diff --from-url "$DIRECT_URL" \
     --to-schema-datamodel prisma/schema.prisma --script
   ```

   The command must produce no SQL. Resolve any drift manually and repeat the
   check; never mark a drifted database as migrated.
3. Mark the verified baseline as applied without executing its create-table
   SQL:

   ```bash
   npx prisma migrate resolve --applied 20260816141000_initial_schema
   ```

4. Run `npm run db:deploy`, then `npx prisma migrate status`.

Only one release job may run migrations at a time. Each later schema change
must be committed as a new Prisma migration and applied with `db:deploy`.

## Deploy and readiness

1. Build the immutable application artifact with `npm run build`.
2. Run `npm run db:deploy` as a single release step before switching traffic.
3. Start the application with `npm run start`. It runs the same redacted
   preflight before Next.js starts, refuses an unsupported Node runtime or
   unsafe release configuration, and refuses to replace a process already
   listening on `PORT`. Do not use a port-killing wrapper in a release job.
4. Sign in through the staging domain as a Prisma user with the exact
   `ADMIN` role, complete the admin passcode gate, then use that browser
   session to load `GET /api/admin/system` (or the System view in `/admin`).
   A successful response includes the current `health` object; record it in
   the release evidence. This endpoint intentionally does **not** accept
   `Authorization: Bearer $ADMIN_API_SECRET`; it requires both a verified
   admin session and the live admin-gate cookie.
5. Hand off to the final verification phase for the staged auth, Stripe
   webhook, generation queue, media storage, rate-limit, and moderation flows.
   These flows are intentionally not exercised by this quality-gate workflow.

## Rollback

Application rollback is safe only when the target version is compatible with
the deployed schema. Prisma has no automatic production down-migration in this
repository: for a bad migration, pause writes, restore the verified database
backup or apply a reviewed forward repair migration, then redeploy the
compatible application artifact. Record the migration status and the recovery
decision in the release incident.

## Private media deletion check

Before enabling public traffic, verify a staging generation can be opened only
with its owner-authorized signed URL. Direct bucket/object URLs must be denied.
Delete the generation through `DELETE /api/assets/:id`, verify the object is
absent from R2/S3, and confirm a new signed request returns not found. A failed
physical object delete leaves the database asset undeleted so it can be retried;
do not declare a soft delete successful while the private object remains.
