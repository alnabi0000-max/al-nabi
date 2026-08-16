-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'STARTER', 'PRO', 'CREATOR', 'BUSINESS', 'STUDIO');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'WARNING', 'BANNED');

-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('SIGNUP_GRANT', 'PURCHASE', 'CHARGE', 'BONUS', 'REFERRAL', 'ROLLBACK', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "GenerationType" AS ENUM ('IMAGE', 'IMAGE_TO_VIDEO', 'TEXT_TO_VIDEO', 'SCRIPT_TO_MOVIE', 'INPAINT', 'OUTPAINT');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('QUEUED', 'ANALYZING', 'GENERATING_AUDIO', 'GENERATING_VIDEO', 'MERGING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "alnabiy_key" TEXT NOT NULL,
    "coins" INTEGER NOT NULL DEFAULT 200,
    "plan" "PlanType" NOT NULL DEFAULT 'FREE',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "security_attempts" INTEGER NOT NULL DEFAULT 0,
    "referral_code" TEXT NOT NULL,
    "referred_by" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'uz',
    "stripe_customer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producer_interest_profiles" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "interest_tags" JSONB NOT NULL DEFAULT '[]',
    "style_tags" JSONB NOT NULL DEFAULT '[]',
    "duration_bucket" TEXT,
    "preferred_aspect" TEXT,
    "sample_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producer_interest_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_ledger" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "type" "LedgerKind" NOT NULL,
    "reason" TEXT NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "generation_id" TEXT,
    "purchase_id" TEXT,
    "job_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generations" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "GenerationType" NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "prompt" TEXT,
    "enhanced_prompt" TEXT,
    "script" TEXT,
    "style" TEXT,
    "emotion_mode" TEXT DEFAULT 'neutral',
    "quality" TEXT DEFAULT '1080p',
    "provider" TEXT,
    "duration_sec" INTEGER NOT NULL DEFAULT 30,
    "camera_move" TEXT,
    "source_image_url" TEXT,
    "identity_locked" BOOLEAN NOT NULL DEFAULT false,
    "scenes_json" JSONB,
    "result_url" TEXT,
    "r2_key" TEXT,
    "credits_cost" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "inngest_event_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "pack_id" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "stripe_session_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "region_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrer_id" UUID NOT NULL,
    "invitee_email" TEXT NOT NULL,
    "invitee_id" UUID,
    "reward_coins" INTEGER NOT NULL DEFAULT 200,
    "rewarded" BOOLEAN NOT NULL DEFAULT false,
    "rewarded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "device_info" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_assets" (
    "id" TEXT NOT NULL,
    "generation_id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "visual_prompt" TEXT NOT NULL,
    "voice_text" TEXT,
    "camera_movement" TEXT,
    "duration_sec" INTEGER NOT NULL DEFAULT 6,
    "video_path" TEXT,
    "audio_path" TEXT,
    "r2_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scene_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_alnabiy_key_key" ON "users"("alnabiy_key");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_alnabiy_key_idx" ON "users"("alnabiy_key");

-- CreateIndex
CREATE INDEX "users_referral_code_idx" ON "users"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "producer_interest_profiles_user_id_key" ON "producer_interest_profiles"("user_id");

-- CreateIndex
CREATE INDEX "producer_interest_profiles_user_id_idx" ON "producer_interest_profiles"("user_id");

-- CreateIndex
CREATE INDEX "coin_ledger_user_id_created_at_idx" ON "coin_ledger"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "coin_ledger_type_idx" ON "coin_ledger"("type");

-- CreateIndex
CREATE INDEX "coin_ledger_generation_id_idx" ON "coin_ledger"("generation_id");

-- CreateIndex
CREATE INDEX "coin_ledger_purchase_id_idx" ON "coin_ledger"("purchase_id");

-- CreateIndex
CREATE INDEX "coin_ledger_job_id_idx" ON "coin_ledger"("job_id");

-- CreateIndex
CREATE INDEX "generations_user_id_status_idx" ON "generations"("user_id", "status");

-- CreateIndex
CREATE INDEX "generations_user_id_deleted_at_idx" ON "generations"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "generations_status_created_at_idx" ON "generations"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_stripe_session_id_key" ON "purchases"("stripe_session_id");

-- CreateIndex
CREATE INDEX "purchases_user_id_status_idx" ON "purchases"("user_id", "status");

-- CreateIndex
CREATE INDEX "purchases_pack_id_idx" ON "purchases"("pack_id");

-- CreateIndex
CREATE INDEX "referrals_referrer_id_idx" ON "referrals"("referrer_id");

-- CreateIndex
CREATE INDEX "referrals_invitee_email_idx" ON "referrals"("invitee_email");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referrer_id_invitee_email_key" ON "referrals"("referrer_id", "invitee_email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "scene_assets_generation_id_idx" ON "scene_assets"("generation_id");

-- AddForeignKey
ALTER TABLE "producer_interest_profiles" ADD CONSTRAINT "producer_interest_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_ledger" ADD CONSTRAINT "coin_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_ledger" ADD CONSTRAINT "coin_ledger_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_ledger" ADD CONSTRAINT "coin_ledger_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generations" ADD CONSTRAINT "generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_assets" ADD CONSTRAINT "scene_assets_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
