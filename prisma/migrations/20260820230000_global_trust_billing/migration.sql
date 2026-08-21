-- Phase 4: global trust, safety governance, privacy operations, and billing
-- reconciliation. This migration is additive and intentionally never changes
-- prior ledger, project, media, or consent history rows.

CREATE TYPE "ConsentDocument" AS ENUM (
  'TERMS',
  'PRIVACY',
  'AI_MEDIA_PROCESSING',
  'PRODUCT_IMPROVEMENT'
);
CREATE TYPE "ConsentAction" AS ENUM ('GRANTED', 'WITHDRAWN');
CREATE TYPE "SafetyOutcome" AS ENUM ('ALLOW', 'BLOCK', 'REVIEW', 'UNAVAILABLE');
CREATE TYPE "PrivacyRequestType" AS ENUM ('DATA_EXPORT', 'ACCOUNT_ERASURE');
CREATE TYPE "PrivacyRequestStatus" AS ENUM (
  'PENDING_CONFIRMATION',
  'REQUESTED',
  'HELD',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);
CREATE TYPE "BillingProvider" AS ENUM ('STRIPE');
CREATE TYPE "BillingWebhookStatus" AS ENUM (
  'PROCESSING',
  'PROCESSED',
  'FAILED',
  'IGNORED'
);
CREATE TYPE "BillingSubscriptionStatus" AS ENUM (
  'ACTIVE',
  'TRIALING',
  'PAST_DUE',
  'CANCELED',
  'INCOMPLETE',
  'UNPAID'
);
CREATE TYPE "EntitlementSource" AS ENUM (
  'SUBSCRIPTION',
  'MANUAL',
  'PROMOTIONAL'
);
CREATE TYPE "ReconciliationStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

CREATE TABLE "user_consents" (
  "id" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "document" "ConsentDocument" NOT NULL,
  "document_version" TEXT NOT NULL,
  "action" "ConsentAction" NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'self_service',
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "safety_audits" (
  "id" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "surface" TEXT NOT NULL,
  "policy_version" TEXT NOT NULL,
  "outcome" "SafetyOutcome" NOT NULL,
  "input_digest" TEXT NOT NULL,
  "reference_media" BOOLEAN NOT NULL DEFAULT false,
  "evaluator" TEXT NOT NULL,
  "coverage" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "safety_audits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "privacy_requests" (
  "id" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "type" "PrivacyRequestType" NOT NULL,
  "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  "scope" JSONB,
  "confirmation_at" TIMESTAMP(3),
  "hold_reason" TEXT,
  "error_code" TEXT,
  "exported_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_subscriptions" (
  "id" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "provider" "BillingProvider" NOT NULL,
  "provider_customer_id" TEXT NOT NULL,
  "provider_subscription_id" TEXT NOT NULL,
  "status" "BillingSubscriptionStatus" NOT NULL,
  "plan_code" TEXT NOT NULL,
  "current_period_end" TIMESTAMP(3),
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "entitlements" (
  "id" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "source" "EntitlementSource" NOT NULL,
  "source_reference" TEXT NOT NULL,
  "subscription_id" TEXT,
  "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ends_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_webhook_events" (
  "id" TEXT NOT NULL,
  "provider" "BillingProvider" NOT NULL,
  "provider_event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "provider_object_id" TEXT,
  "payload_digest" TEXT NOT NULL,
  "status" "BillingWebhookStatus" NOT NULL DEFAULT 'PROCESSING',
  "user_id" UUID,
  "purchase_id" TEXT,
  "subscription_id" TEXT,
  "error_code" TEXT,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_reconciliations" (
  "id" TEXT NOT NULL,
  "provider" "BillingProvider" NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "subject_key" TEXT NOT NULL,
  "user_id" UUID,
  "status" "ReconciliationStatus" NOT NULL DEFAULT 'OPEN',
  "details" JSONB,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "billing_reconciliations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_consents_user_id_document_document_version_recorded_at_idx"
  ON "user_consents"("user_id", "document", "document_version", "recorded_at");
CREATE INDEX "user_consents_document_document_version_action_idx"
  ON "user_consents"("document", "document_version", "action");
CREATE INDEX "safety_audits_user_id_created_at_idx"
  ON "safety_audits"("user_id", "created_at");
CREATE INDEX "safety_audits_outcome_created_at_idx"
  ON "safety_audits"("outcome", "created_at");
CREATE INDEX "privacy_requests_user_id_created_at_idx"
  ON "privacy_requests"("user_id", "created_at");
CREATE INDEX "privacy_requests_status_updated_at_idx"
  ON "privacy_requests"("status", "updated_at");
CREATE UNIQUE INDEX "billing_subscriptions_provider_provider_subscription_id_key"
  ON "billing_subscriptions"("provider", "provider_subscription_id");
CREATE INDEX "billing_subscriptions_user_id_status_idx"
  ON "billing_subscriptions"("user_id", "status");
CREATE INDEX "billing_subscriptions_provider_customer_id_idx"
  ON "billing_subscriptions"("provider_customer_id");
CREATE UNIQUE INDEX "entitlements_user_id_code_source_source_reference_key"
  ON "entitlements"("user_id", "code", "source", "source_reference");
CREATE INDEX "entitlements_user_id_code_ends_at_idx"
  ON "entitlements"("user_id", "code", "ends_at");
CREATE INDEX "entitlements_subscription_id_idx"
  ON "entitlements"("subscription_id");
CREATE UNIQUE INDEX "billing_webhook_events_provider_provider_event_id_key"
  ON "billing_webhook_events"("provider", "provider_event_id");
CREATE INDEX "billing_webhook_events_status_received_at_idx"
  ON "billing_webhook_events"("status", "received_at");
CREATE INDEX "billing_webhook_events_provider_object_id_idx"
  ON "billing_webhook_events"("provider_object_id");
CREATE UNIQUE INDEX "billing_reconciliations_fingerprint_key"
  ON "billing_reconciliations"("fingerprint");
CREATE INDEX "billing_reconciliations_provider_status_last_seen_at_idx"
  ON "billing_reconciliations"("provider", "status", "last_seen_at");
CREATE INDEX "billing_reconciliations_user_id_status_idx"
  ON "billing_reconciliations"("user_id", "status");

ALTER TABLE "user_consents"
  ADD CONSTRAINT "user_consents_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "safety_audits"
  ADD CONSTRAINT "safety_audits_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "privacy_requests"
  ADD CONSTRAINT "privacy_requests_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_subscriptions"
  ADD CONSTRAINT "billing_subscriptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entitlements"
  ADD CONSTRAINT "entitlements_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "entitlements_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "billing_webhook_events"
  ADD CONSTRAINT "billing_webhook_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "billing_webhook_events_purchase_id_fkey"
  FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "billing_webhook_events_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "billing_reconciliations"
  ADD CONSTRAINT "billing_reconciliations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
