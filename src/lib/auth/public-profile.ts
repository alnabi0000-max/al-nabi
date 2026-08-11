/**
 * /api/auth/me uchun xavfsiz profil — alnabiyKey qaytmaydi.
 */

export type SafePublicProfile = {
  id: string;
  email: string;
  coins: number;
  referralCode: string;
  status: string;
};

export function toSafePublicProfile(user: {
  id: string;
  email: string;
  coins: number;
  referralCode: string;
  status: string;
}): SafePublicProfile {
  return {
    id: user.id,
    email: user.email,
    coins: user.coins,
    referralCode: user.referralCode,
    status: user.status,
  };
}
