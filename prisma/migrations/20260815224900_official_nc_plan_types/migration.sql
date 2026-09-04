-- Official NC PlanType labels. The live database already uses
-- FREE / STARTER / PRO / CREATOR / BUSINESS / STUDIO after db push.
-- Remap only if a leftover Hollywood-era enum value is still present.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PlanType'
      AND e.enumlabel IN ('HOLLYWOOD', 'DIRECTOR', 'INFINITE')
  ) THEN
    ALTER TABLE "users" ALTER COLUMN "plan" DROP DEFAULT;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlanType_new') THEN
      CREATE TYPE "PlanType_new" AS ENUM ('FREE', 'STARTER', 'PRO', 'CREATOR', 'BUSINESS', 'STUDIO');
    END IF;

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
  END IF;
END $$;
