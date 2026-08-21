-- Phase 3: canonical project timeline + private cinematic export lifecycle.

CREATE TYPE "TimelineTrackKind" AS ENUM ('VIDEO', 'AUDIO');
CREATE TYPE "ProjectExportStatus" AS ENUM (
  'QUEUED',
  'CONFIGURATION_REQUIRED',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

CREATE TABLE "project_timelines" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "fps" INTEGER NOT NULL DEFAULT 24,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "audio_mix" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_timelines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_timeline_tracks" (
    "id" TEXT NOT NULL,
    "timeline_id" TEXT NOT NULL,
    "kind" "TimelineTrackKind" NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_timeline_tracks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_timeline_clips" (
    "id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "start_ms" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "trim_start_ms" INTEGER NOT NULL DEFAULT 0,
    "trim_end_ms" INTEGER NOT NULL DEFAULT 0,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "source_asset_id" TEXT,
    "source_render_version_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_timeline_clips_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_timeline_clips_one_source_check"
      CHECK (
        ("source_asset_id" IS NOT NULL AND "source_render_version_id" IS NULL)
        OR ("source_asset_id" IS NULL AND "source_render_version_id" IS NOT NULL)
      ),
    CONSTRAINT "project_timeline_clips_time_check"
      CHECK (
        "start_ms" >= 0
        AND "duration_ms" > 0
        AND "trim_start_ms" >= 0
        AND "trim_end_ms" >= 0
      ),
    CONSTRAINT "project_timeline_clips_volume_check"
      CHECK ("volume" >= 0 AND "volume" <= 2)
);

CREATE TABLE "project_exports" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "timeline_id" TEXT NOT NULL,
    "generation_id" TEXT,
    "timeline_revision" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" "ProjectExportStatus" NOT NULL DEFAULT 'QUEUED',
    "format" TEXT NOT NULL DEFAULT 'mp4',
    "quality" TEXT NOT NULL DEFAULT '1080p',
    "frame_rate" INTEGER NOT NULL DEFAULT 24,
    "audio_mix" JSONB NOT NULL DEFAULT '{}',
    "timeline_snapshot" JSONB NOT NULL,
    "output_r2_key" TEXT,
    "output_url" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "worker_metadata" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_exports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_exports_frame_rate_check" CHECK ("frame_rate" IN (24, 30, 60))
);

CREATE UNIQUE INDEX "project_timelines_project_id_key" ON "project_timelines"("project_id");
CREATE UNIQUE INDEX "project_timeline_tracks_timeline_id_position_key"
  ON "project_timeline_tracks"("timeline_id", "position");
CREATE UNIQUE INDEX "project_timeline_clips_track_id_position_key"
  ON "project_timeline_clips"("track_id", "position");
CREATE UNIQUE INDEX "project_exports_user_id_idempotency_key_key"
  ON "project_exports"("user_id", "idempotency_key");
CREATE UNIQUE INDEX "project_exports_generation_id_key"
  ON "project_exports"("generation_id");

CREATE INDEX "project_timelines_project_id_updated_at_idx"
  ON "project_timelines"("project_id", "updated_at");
CREATE INDEX "project_timeline_tracks_timeline_id_kind_idx"
  ON "project_timeline_tracks"("timeline_id", "kind");
CREATE INDEX "project_timeline_clips_track_id_start_ms_idx"
  ON "project_timeline_clips"("track_id", "start_ms");
CREATE INDEX "project_timeline_clips_source_asset_id_idx"
  ON "project_timeline_clips"("source_asset_id");
CREATE INDEX "project_timeline_clips_source_render_version_id_idx"
  ON "project_timeline_clips"("source_render_version_id");
CREATE INDEX "project_exports_project_id_created_at_idx"
  ON "project_exports"("project_id", "created_at");
CREATE INDEX "project_exports_timeline_id_timeline_revision_idx"
  ON "project_exports"("timeline_id", "timeline_revision");
CREATE INDEX "project_exports_status_updated_at_idx"
  ON "project_exports"("status", "updated_at");

ALTER TABLE "project_timelines"
  ADD CONSTRAINT "project_timelines_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_timeline_tracks"
  ADD CONSTRAINT "project_timeline_tracks_timeline_id_fkey"
  FOREIGN KEY ("timeline_id") REFERENCES "project_timelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_timeline_clips"
  ADD CONSTRAINT "project_timeline_clips_track_id_fkey"
  FOREIGN KEY ("track_id") REFERENCES "project_timeline_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_timeline_clips_source_asset_id_fkey"
  FOREIGN KEY ("source_asset_id") REFERENCES "project_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_timeline_clips_source_render_version_id_fkey"
  FOREIGN KEY ("source_render_version_id") REFERENCES "render_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_exports"
  ADD CONSTRAINT "project_exports_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_exports_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_exports_timeline_id_fkey"
  FOREIGN KEY ("timeline_id") REFERENCES "project_timelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "project_exports_generation_id_fkey"
  FOREIGN KEY ("generation_id") REFERENCES "generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A clip must never cross project boundaries, even if a future endpoint omits
-- application-level ownership checks.
CREATE OR REPLACE FUNCTION "validate_project_timeline_clip_source"()
RETURNS TRIGGER AS $$
DECLARE
  timeline_project_id TEXT;
  source_project_id TEXT;
BEGIN
  SELECT pt."project_id" INTO timeline_project_id
  FROM "project_timeline_tracks" ptt
  JOIN "project_timelines" pt ON pt."id" = ptt."timeline_id"
  WHERE ptt."id" = NEW."track_id";

  IF timeline_project_id IS NULL THEN
    RAISE EXCEPTION 'Timeline track does not resolve to a project';
  END IF;

  IF NEW."source_asset_id" IS NOT NULL THEN
    SELECT "project_id" INTO source_project_id
    FROM "project_assets"
    WHERE "id" = NEW."source_asset_id";
  ELSE
    SELECT "project_id" INTO source_project_id
    FROM "render_versions"
    WHERE "id" = NEW."source_render_version_id";
  END IF;

  IF source_project_id IS DISTINCT FROM timeline_project_id THEN
    RAISE EXCEPTION 'Timeline clip source must belong to the same project';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_timeline_clip_source_project_guard"
  BEFORE INSERT OR UPDATE OF "track_id", "source_asset_id", "source_render_version_id"
  ON "project_timeline_clips"
  FOR EACH ROW EXECUTE FUNCTION "validate_project_timeline_clip_source"();

CREATE OR REPLACE FUNCTION "validate_project_export_timeline"()
RETURNS TRIGGER AS $$
DECLARE
  timeline_project_id TEXT;
BEGIN
  SELECT "project_id" INTO timeline_project_id
  FROM "project_timelines"
  WHERE "id" = NEW."timeline_id";

  IF timeline_project_id IS DISTINCT FROM NEW."project_id" THEN
    RAISE EXCEPTION 'Project export timeline must belong to the same project';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_export_timeline_project_guard"
  BEFORE INSERT OR UPDATE OF "project_id", "timeline_id"
  ON "project_exports"
  FOR EACH ROW EXECUTE FUNCTION "validate_project_export_timeline"();
