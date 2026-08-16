/**
 * /api/auth/me uchun xavfsiz profil — alnabiyKey qaytmaydi.
 */

export type SafePublicProfile = {
  id: string;
  email: string;
  coins: number;
  referralCode: string;
  status: string;
  role: string;
  authProvider: string;
  createdAt: string | null;
};

export function toSafePublicProfile(user: {
  id: string;
  email: string;
  coins: number;
  referralCode: string;
  status: string;
  role?: string | null;
  authProvider?: string | null;
  createdAt?: Date | string | null;
}): SafePublicProfile {
  const createdAt =
    user.createdAt instanceof Date
      ? user.createdAt.toISOString()
      : user.createdAt || null;

  return {
    id: user.id,
    email: user.email,
    coins: user.coins,
    referralCode: user.referralCode,
    status: user.status,
    role: user.role || "USER",
    authProvider: user.authProvider || "MAGIC_LINK",
    createdAt,
  };
}
