-- CreateTable
CREATE TABLE "admin_settings" (
    "id" TEXT NOT NULL,
    "passcode_hash" TEXT NOT NULL,
    "token_version" INTEGER NOT NULL DEFAULT 1,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("id")
);
