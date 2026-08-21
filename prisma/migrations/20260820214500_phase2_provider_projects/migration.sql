-- Phase 2: creator projects, versioned renders, approvals, and spend reservations.

CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "ProjectAssetKind" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');
CREATE TYPE "RenderVersionStatus" AS ENUM ('QUEUED', 'RENDERING', 'COMPLETED', 'FAILED', 'APPROVED', 'REJECTED');
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');
CREATE TYPE "ModelRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT,
    "aspect" TEXT NOT NULL DEFAULT '16:9',
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "spend_cap_nc" INTEGER,
    "spent_nc" INTEGER NOT NULL DEFAULT 0,
    "reserved_nc" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shots" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT,
    "negative_prompt" TEXT,
    "aspect" TEXT,
    "quality" TEXT,
    "duration_sec" INTEGER,
    "preferred_engine" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_assets" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "project_id" TEXT,
    "label" TEXT NOT NULL,
    "kind" "ProjectAssetKind" NOT NULL,
    "source_generation_id" TEXT,
    "r2_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reference_packs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_packs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "render_versions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "shot_id" TEXT,
    "generation_id" TEXT,
    "number" INTEGER NOT NULL,
    "status" "RenderVersionStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT,
    "model" TEXT,
    "output_r2_key" TEXT,
    "output_url" TEXT,
    "estimated_credits" INTEGER NOT NULL DEFAULT 0,
    "credits_cost" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "render_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "model_runs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "render_version_id" TEXT NOT NULL,
    "generation_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "engine_id" TEXT NOT NULL,
    "endpoint_model" TEXT,
    "commercial_route" TEXT NOT NULL,
    "status" "ModelRunStatus" NOT NULL DEFAULT 'QUEUED',
    "estimated_credits" INTEGER NOT NULL DEFAULT 0,
    "expected_p50_sec" INTEGER,
    "expected_p90_sec" INTEGER,
    "request_metadata" JSONB,
    "response_metadata" JSONB,
    "failure_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "shot_id" TEXT,
    "render_version_id" TEXT,
    "user_id" UUID NOT NULL,
    "decision" "ApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_ProjectAssetToReferencePack" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

ALTER TABLE "generations"
  ADD COLUMN "project_id" TEXT,
  ADD COLUMN "shot_id" TEXT,
  ADD COLUMN "reserved_credits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "project_charge_settled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "project_refund_settled" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "shots_project_id_position_key" ON "shots"("project_id", "position");
CREATE UNIQUE INDEX "render_versions_generation_id_key" ON "render_versions"("generation_id");
CREATE UNIQUE INDEX "model_runs_generation_id_key" ON "model_runs"("generation_id");
CREATE UNIQUE INDEX "coin_ledger_generation_id_type_key" ON "coin_ledger"("generation_id", "type");
CREATE UNIQUE INDEX "_ProjectAssetToReferencePack_AB_unique" ON "_ProjectAssetToReferencePack"("A", "B");

CREATE INDEX "projects_user_id_updated_at_idx" ON "projects"("user_id", "updated_at");
CREATE INDEX "projects_user_id_status_idx" ON "projects"("user_id", "status");
CREATE INDEX "shots_project_id_updated_at_idx" ON "shots"("project_id", "updated_at");
CREATE INDEX "project_assets_user_id_created_at_idx" ON "project_assets"("user_id", "created_at");
CREATE INDEX "project_assets_project_id_created_at_idx" ON "project_assets"("project_id", "created_at");
CREATE INDEX "project_assets_source_generation_id_idx" ON "project_assets"("source_generation_id");
CREATE INDEX "reference_packs_project_id_updated_at_idx" ON "reference_packs"("project_id", "updated_at");
CREATE INDEX "render_versions_project_id_created_at_idx" ON "render_versions"("project_id", "created_at");
CREATE INDEX "render_versions_shot_id_created_at_idx" ON "render_versions"("shot_id", "created_at");
CREATE INDEX "model_runs_project_id_created_at_idx" ON "model_runs"("project_id", "created_at");
CREATE INDEX "model_runs_render_version_id_idx" ON "model_runs"("render_version_id");
CREATE INDEX "approvals_project_id_created_at_idx" ON "approvals"("project_id", "created_at");
CREATE INDEX "approvals_render_version_id_created_at_idx" ON "approvals"("render_version_id", "created_at");
CREATE INDEX "generations_project_id_created_at_idx" ON "generations"("project_id", "created_at");
CREATE INDEX "generations_shot_id_created_at_idx" ON "generations"("shot_id", "created_at");
CREATE INDEX "_ProjectAssetToReferencePack_B_index" ON "_ProjectAssetToReferencePack"("B");

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shots"
  ADD CONSTRAINT "shots_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_assets"
  ADD CONSTRAINT "project_assets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_assets_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_assets_source_generation_id_fkey"
  FOREIGN KEY ("source_generation_id") REFERENCES "generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reference_packs"
  ADD CONSTRAINT "reference_packs_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "render_versions"
  ADD CONSTRAINT "render_versions_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "render_versions_shot_id_fkey"
  FOREIGN KEY ("shot_id") REFERENCES "shots"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "render_versions_generation_id_fkey"
  FOREIGN KEY ("generation_id") REFERENCES "generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approvals"
  ADD CONSTRAINT "approvals_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "approvals_shot_id_fkey"
  FOREIGN KEY ("shot_id") REFERENCES "shots"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "approvals_render_version_id_fkey"
  FOREIGN KEY ("render_version_id") REFERENCES "render_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "approvals_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_runs"
  ADD CONSTRAINT "model_runs_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "model_runs_render_version_id_fkey"
  FOREIGN KEY ("render_version_id") REFERENCES "render_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "model_runs_generation_id_fkey"
  FOREIGN KEY ("generation_id") REFERENCES "generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generations"
  ADD CONSTRAINT "generations_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "generations_shot_id_fkey"
  FOREIGN KEY ("shot_id") REFERENCES "shots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "_ProjectAssetToReferencePack"
  ADD CONSTRAINT "_ProjectAssetToReferencePack_A_fkey"
  FOREIGN KEY ("A") REFERENCES "project_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "_ProjectAssetToReferencePack_B_fkey"
  FOREIGN KEY ("B") REFERENCES "reference_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
