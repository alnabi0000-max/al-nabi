import type { SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";
import { onboardNewUser } from "@/lib/auth/onboarding";
import type { LedgerUser } from "@/lib/auth/ensure-request-user";
import {
  isAlreadyRegistered,
  isEmailNotConfirmed,
  isInvalidCredentials,
  publicPasswordAuthError,
} from "@/lib/auth/password-errors";
import { tryCreateAdminClient } from "@/lib/supabase/admin";

function asLedger(user: {
  id: string;
  email: string;
  alnabiyKey: string;
  coins: number;
  referralCode: string;
  status: string;
  role: string;
  authProvider: string;
  createdAt: Date;
}): LedgerUser {
  return {
    id: user.id,
    email: user.email,
    alnabiyKey: user.alnabiyKey,
    coins: user.coins,
    referralCode: user.referralCode,
    status: user.status as LedgerUser["status"],
    role: user.role as LedgerUser["role"],
    authProvider: user.authProvider as LedgerUser["authProvider"],
    createdAt: user.createdAt,
  };
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key || !tryCreateAdminClient()) return null;

  const res = await fetch(
    `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    }
  );
  if (!res.ok) return null;

  const body = (await res.json().catch(() => null)) as {
    users?: Array<{ id?: string; email?: string }>;
    id?: string;
    email?: string;
  } | null;
  const users = Array.isArray(body?.users) ? body.users : [];
  const match = users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
  if (match?.id) return match.id;
  if (body?.id && body.email?.toLowerCase() === email.toLowerCase()) {
    return body.id;
  }
  return null;
}

export async function confirmSupabaseEmail(
  email: string,
  userId?: string | null
): Promise<boolean> {
  const admin = tryCreateAdminClient();
  if (!admin) return false;
  const id = userId || (await findUserIdByEmail(email));
  if (!id) return false;
  const { error } = await admin.auth.admin.updateUserById(id, {
    email_confirm: true,
  });
  return !error;
}

async function ensureRegisteredUser(email: string, password: string) {
  const admin = tryCreateAdminClient();
  if (admin) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (!created.error) {
      return { existed: false, userId: created.data.user?.id ?? null };
    }
    if (!isAlreadyRegistered(created.error)) {
      return { error: created.error };
    }
    await confirmSupabaseEmail(email);
    return { existed: true, userId: null };
  }
  return { existed: false, userId: null, needsSignUp: true as const };
}

export async function completePasswordAuth(opts: {
  supabase: SupabaseClient;
  email: string;
  password: string;
  register: boolean;
}): Promise<
  | { ok: true; user: LedgerUser }
  | { ok: false; status: number; error: string }
> {
  const email = opts.email.toLowerCase();
  let knownId: string | null = null;
  let existed = false;

  if (opts.register) {
    const registered = await ensureRegisteredUser(email, opts.password);
    if ("error" in registered && registered.error) {
      return {
        ok: false,
        status: 400,
        error: publicPasswordAuthError(registered.error),
      };
    }
    knownId = registered.userId;
    existed = Boolean(registered.existed);

    if (registered.needsSignUp) {
      const signed = await opts.supabase.auth.signUp({
        email,
        password: opts.password,
      });
      if (signed.error && !isAlreadyRegistered(signed.error)) {
        return {
          ok: false,
          status: 400,
          error: publicPasswordAuthError(signed.error),
        };
      }
      knownId = signed.data.user?.id ?? knownId;
      if (signed.data.user?.id && !signed.data.session) {
        await confirmSupabaseEmail(email, signed.data.user.id);
      }
      existed = Boolean(signed.error && isAlreadyRegistered(signed.error));
    }
  }

  let { data, error } = await opts.supabase.auth.signInWithPassword({
    email,
    password: opts.password,
  });

  if (error && isEmailNotConfirmed(error)) {
    await confirmSupabaseEmail(email, knownId || data.user?.id);
    const retry = await opts.supabase.auth.signInWithPassword({
      email,
      password: opts.password,
    });
    data = retry.data;
    error = retry.error;
  }

  if (error || !data.user?.id || !data.user.email) {
    const status =
      opts.register && existed && isInvalidCredentials(error)
        ? 409
        : isInvalidCredentials(error)
          ? 401
          : 400;
    return {
      ok: false,
      status,
      error:
        status === 409
          ? "Email already registered"
          : publicPasswordAuthError(error),
    };
  }

  return ledgerFromSupabaseUser(data.user);
}

async function ledgerFromSupabaseUser(
  identity: SupabaseUser
): Promise<
  | { ok: true; user: LedgerUser }
  | { ok: false; status: number; error: string }
> {
  const { user } = await onboardNewUser(
    {
      id: identity.id,
      email: identity.email || "",
      name:
        (identity.user_metadata?.full_name as string | undefined) ||
        (identity.user_metadata?.name as string | undefined) ||
        null,
      authProvider: "PASSWORD",
    },
    { source: "password_auth", sendEmail: false }
  );

  if (user.status === "BANNED") {
    return { ok: false, status: 403, error: "ACCOUNT PERMANENTLY BANNED" };
  }

  return { ok: true, user: asLedger(user) };
}
