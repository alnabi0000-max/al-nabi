-- Standalone remap for databases that already have the old PlanType enum
-- and are applied via `psql` / Supabase SQL rather than `prisma migrate`.
-- Safe to run once: existing FREE / STARTER / PRO rows are unchanged.

ALTER TABLE "users" ALTER COLUMN "plan" DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlanType_new') THEN
    CREATE TYPE "PlanType_new" AS ENUM ('FREE', 'STARTER', 'PRO', 'CREATOR', 'BUSINESS', 'STUDIO');
  END IF;
END $$;

ALTER TABLE "users"
  ALTER COLUMN "plan" TYPE "PlanType_new"
  USING (
    CASE "plan"::text
      WHEN 'HOLLYWOOD' THEN 'CREATOR'
      WHEN 'DIRECTOR' THEN 'BUSINESS'
      WHEN 'INFINITE' THEN 'STUDIO'
      ELSE "plan"::text
    END
  )::"PlanType_new";

DROP TYPE IF EXISTS "PlanType";

ALTER TYPE "PlanType_new" RENAME TO "PlanType";

ALTER TABLE "users" ALTER COLUMN "plan" SET DEFAULT 'FREE';
