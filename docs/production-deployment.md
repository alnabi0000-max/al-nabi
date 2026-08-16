# Production deployment runbook

This runbook covers the release mechanics owned by this repository. It does
not replace the final staging end-to-end verification of authentication,
payments, generation, storage, rate limiting, and moderation.

## Release gates

Use Node `22.13.x` (the supported range is declared in `package.json`) and npm
10 or newer. A change is eligible for deployment only after the pull request
workflow succeeds:

```bash
npm ci
npm run ci
```

`npm run ci` runs ESLint with zero warnings, TypeScript checking, focused unit
tests, and the production build. It deliberately does not need production
credentials or a live database.

## Production configuration preflight

Set all values in the deployment platform's encrypted secret store; never
paste a production `.env` file into source control or CI logs. Before enabling
traffic, have the security/operations owner verify the production validation
for:

- `DATABASE_URL` (pooled runtime connection) and `DIRECT_URL` (direct
  migration connection).
- Supabase URL, anon key, service-role key where used, `AUTH_MODE=supabase`,
  and a random 32+ character `AUTH_SECRET`.
- Stripe secret and webhook signing secret.
- OpenRouter, Replicate, Inngest, Upstash, and a complete R2 or S3 credential
  set.
- `ADMIN_API_SECRET`, `CRON_SECRET`, and `ALNABIY_OBFUSCATE_SECRET`.
- No local/demo/mock/bypass flags, including `AUTH_MODE=local`,
  `ALNABIY_DEV_AUTH_BYPASS`, `ALLOW_DEMO_CHECKOUT`, `ALLOW_SOFT_CREDITS`,
  `ALNABIY_FORCE_MOCK`, or `ALNABIY_ALLOW_AUDIO_MOCK`.

Provision FFmpeg-dependent work on its dedicated worker/self-hosted runtime;
do not assume a serverless deployment supplies FFmpeg.

## Prisma migration procedure

`prisma/migrations/20260816141000_initial_schema` is the source-controlled
baseline for a new database. Production must use `npm run db:deploy`; do not
use `db:push:local` or `db:migrate` against production.

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
3. Start the application with `npm run start:next` (or the platform's
   equivalent `next start` command).
4. Make an authenticated request to `GET /api/admin/system` using
   `Authorization: Bearer $ADMIN_API_SECRET`. A successful response includes
   the current `health` object; record it in the release evidence.
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
