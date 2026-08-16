import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPlaceholderEnvValue } from "@/lib/env";
import {
  MAX_PASSCODE_LENGTH,
  MIN_PASSCODE_LENGTH,
} from "@/lib/admin/passcode-policy";
import { hashPasscode, verifyPasscodeHash } from "@/lib/admin/passcode-hash";

export { MAX_PASSCODE_LENGTH, MIN_PASSCODE_LENGTH };
export { hashPasscode, verifyPasscodeHash };
export const ADMIN_SETTINGS_ID = "singleton";

function bootstrapPasscodeFromEnv(): string | null {
  const value = process.env.ADMIN_MASTER_PASSCODE?.trim() || "";
  if (
    !value ||
    value.length < MIN_PASSCODE_LENGTH ||
    value.length > MAX_PASSCODE_LENGTH ||
    isPlaceholderEnvValue(value)
  ) {
    return null;
  }
  return value;
}

export async function getAdminSettings() {
  const existing = await prisma.adminSettings.findUnique({
    where: { id: ADMIN_SETTINGS_ID },
  });
  if (existing) return existing;

  const bootstrap = bootstrapPasscodeFromEnv();
  if (!bootstrap) return null;

  const passcodeHash = await hashPasscode(bootstrap);
  try {
    return await prisma.adminSettings.create({
      data: {
        id: ADMIN_SETTINGS_ID,
        passcodeHash,
        tokenVersion: 1,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return prisma.adminSettings.findUnique({
        where: { id: ADMIN_SETTINGS_ID },
      });
    }
    throw error;
  }
}

export async function rotateAdminPasscode(opts: {
  newPasscode: string;
  updatedById?: string | null;
}) {
  const passcodeHash = await hashPasscode(opts.newPasscode);
  return prisma.adminSettings.upsert({
    where: { id: ADMIN_SETTINGS_ID },
    create: {
      id: ADMIN_SETTINGS_ID,
      passcodeHash,
      tokenVersion: 1,
      updatedById: opts.updatedById ?? null,
    },
    update: {
      passcodeHash,
      tokenVersion: { increment: 1 },
      updatedById: opts.updatedById ?? null,
    },
  });
}
