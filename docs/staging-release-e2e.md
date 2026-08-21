# Staging release verification

Run this checklist only against a deployed staging domain with its own database,
Supabase project, Stripe test-mode configuration, private bucket, and provider
credentials. Do not point a staging release job at production resources or use
production customer data. Record request IDs, job IDs, Stripe event IDs, and
Sentry links with the release evidence.

## Required sequence after a staging target exists

Before the target exists, the allowed repository-only gates are `npm ci`,
`npm run ci`, and `npm audit --omit=dev --audit-level=high`. Once operations
have provisioned and identified the staging target, the release owner must run
these ordered target-bound commands from the secure release environment:

```bash
npm run launch:check -- --json
npm run db:deploy
npx prisma migrate status
npm run start
```

The first command emits only redacted check IDs and hints. It must pass before
a migration or application process is started. `db:deploy` is the only
permitted migration command and runs once, with one release job owning the
migration lock. `migrate status` must show the complete tracked migration
sequence. `npm run start` repeats the preflight and refuses to replace a
process that is already using `PORT`.

Do not start the smoke flows until the release job has also passed `npm run ci`
and `npm audit --omit=dev --audit-level=high`.

## Required smoke flows

1. **Auth and admin:** sign in through email and every enabled social provider;
   verify an ordinary user cannot open `/admin` or `GET /api/admin/system`.
   Sign in as an exact Prisma `ADMIN`, complete the admin passcode gate, and
   verify the system health response with the browser session. `ADMIN_API_SECRET`
   must not authorize that endpoint.
2. **Payments:** complete a Stripe test-mode pack purchase, verify the signed
   webhook creates exactly one ledger credit, replay the same event, and verify
   no duplicate credit is created.
3. **Generation and queue:** submit one image and one video from a test owner,
   confirm Inngest receives and completes each job, and verify a failed provider
   job is retried/refunded exactly once.
4. **Private storage:** for each completed generation, verify the raw R2/S3
   object URL is denied, the owner receives a signed URL, and a second account
   receives `403` from `/api/media/sign`.
5. **Deletion:** delete a generated asset through `/api/assets/:id`, verify the
   R2/S3 object is gone, then verify the owner cannot obtain a new signed URL.
   If physical deletion fails, the release is blocked until the object is
   removed and the failure cause is recorded.
6. **Operational integrations:** trigger one controlled Upstash rate-limit
   response; verify an Inngest signed callback; send a moderation-blocked
   request; create a test Sentry event; and confirm the Resend test mailbox
   receives the expected transactional message.

## Evidence and exit criteria

- Store the `DIRECT_URL` migration-status output and a verified backup/restore
  drill reference with the release evidence.
- The bucket policy must block public reads; no public object base URL is a
  valid delivery path.
- There are no unresolved high-severity production dependency audit findings.
- A Next.js major upgrade is a separate release gate with its own clean Linux
  CI, migration smoke, and the complete checklist above.
- A Windows-local build that is blocked by a Prisma file lock does not satisfy
  the clean-build gate. Re-run it in clean Linux CI or after releasing the
  locking process.
