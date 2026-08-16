-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL_OTP', 'MAGIC_LINK', 'PASSWORD', 'GOOGLE', 'APPLE', 'LOCAL');

-- AlterTable
ALTER TABLE "users"
    ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
    ADD COLUMN "auth_provider" "AuthProvider" NOT NULL DEFAULT 'MAGIC_LINK',
    ADD COLUMN "last_login_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");
