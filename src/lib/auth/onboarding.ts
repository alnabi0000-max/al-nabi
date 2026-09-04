import { prisma } from "@/lib/prisma";
import { ensurePrismaUser, type AuthIdentity } from "@/lib/auth/ensure-user";
import {
  sendWelcomeEmail,
  upsertMarketingContact,
} from "@/lib/email/welcome";

/**
 * Yangi foydalanuvchi: Prisma User + bonus coins + welcome email + marketing.
 */
export async function onboardNewUser(
  identity: AuthIdentity,
  opts?: { sendEmail?: boolean; source?: string }
) {
  const email = identity.email.toLowerCase();
  let existing = null as Awaited<
    ReturnType<typeof prisma.user.findUnique>
  > | null;
  try {
    existing =
      (await prisma.user.findUnique({ where: { id: identity.id } })) ||
      (await prisma.user.findUnique({ where: { email } }));
  } catch {
    existing = null;
  }

  const user = await ensurePrismaUser(identity);
  const isNew = !existing;

  if (isNew) {
    await upsertMarketingContact({
      email: user.email,
      name: user.name,
      source: opts?.source || "signup",
    });

    if (opts?.sendEmail !== false) {
      await sendWelcomeEmail({
        email: user.email,
        name: user.name,
        coins: user.coins,
        referralCode: user.referralCode,
      });
    }
  }

  return { user, isNew };
}
