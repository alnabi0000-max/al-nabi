/** Persistent session — 365 kun (brauzer yopilsa ham saqlanadi) */
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 365;

export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: SESSION_MAX_AGE_SEC,
  // secure productionda middleware/client da qo‘yiladi
};

/** Supabase SSR cookieOptions */
export function supabaseCookieOptions(secure?: boolean) {
  return {
    ...SESSION_COOKIE_OPTIONS,
    secure:
      typeof secure === "boolean"
        ? secure
        : process.env.NODE_ENV === "production",
  };
}

type CookieOptsLike = {
  path?: string;
  maxAge?: number;
  sameSite?: boolean | "lax" | "strict" | "none";
  secure?: boolean;
  httpOnly?: boolean;
  domain?: string;
  expires?: Date;
  [key: string]: unknown;
};

/** Cookie setAll uchun maxAge majburiy qo‘shish */
export function withPersistentCookieOptions<T extends CookieOptsLike>(
  options?: T
): T & typeof SESSION_COOKIE_OPTIONS {
  return {
    ...(options || ({} as T)),
    path: "/",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SEC,
    secure:
      options?.secure ?? process.env.NODE_ENV === "production",
  } as T & typeof SESSION_COOKIE_OPTIONS;
}
