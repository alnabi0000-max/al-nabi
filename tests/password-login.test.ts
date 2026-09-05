import { beforeEach, describe, expect, it, vi } from "vitest";

const onboardNewUser = vi.fn();
const tryCreateAdminClient = vi.fn();

vi.mock("@/lib/auth/onboarding", () => ({
  onboardNewUser: (...args: unknown[]) => onboardNewUser(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  tryCreateAdminClient: () => tryCreateAdminClient(),
}));

import { completePasswordAuth } from "@/lib/auth/password-login";
import { PUBLIC_AUTH_ERRORS } from "@/lib/auth/password-errors";

const identity = {
  id: "user-1",
  email: "creator@alnabiy.app",
};

const ledger = {
  id: "user-1",
  email: "creator@alnabiy.app",
  alnabiyKey: "ALN-1",
  coins: 40,
  referralCode: "REF",
  status: "ACTIVE",
  role: "USER",
  authProvider: "PASSWORD",
  createdAt: new Date("2026-01-01"),
};

function adminClient(create?: {
  data?: { user?: { id: string } | null };
  error?: { message: string; code?: string } | null;
}) {
  return {
    auth: {
      admin: {
        createUser: vi.fn(async () => ({
          data: { user: create?.data?.user ?? { id: "user-1" } },
          error: create?.error ?? null,
        })),
        updateUserById: vi.fn(async () => ({ error: null })),
      },
    },
  };
}

function supabaseClient(opts: {
  signIn: { data: { user: typeof identity | null }; error: unknown };
  signInRetry?: { data: { user: typeof identity | null }; error: unknown };
  signUp?: { data: { user: typeof identity | null; session: null }; error: unknown };
}) {
  let calls = 0;
  return {
    auth: {
      signInWithPassword: vi.fn(async () => {
        calls += 1;
        if (calls > 1 && opts.signInRetry) return opts.signInRetry;
        return opts.signIn;
      }),
      signUp: vi.fn(async () => opts.signUp ?? { data: { user: null, session: null }, error: null }),
    },
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  onboardNewUser.mockReset();
  tryCreateAdminClient.mockReset();
  onboardNewUser.mockResolvedValue({ user: ledger, isNew: true });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
});

describe("completePasswordAuth", () => {
  it("registers a new user then signs them in", async () => {
    tryCreateAdminClient.mockReturnValue(adminClient());
    const supabase = supabaseClient({
      signIn: { data: { user: identity }, error: null },
    });

    const result = await completePasswordAuth({
      supabase: supabase as never,
      email: "Creator@alnabiy.app",
      password: "secret1",
      register: true,
    });

    expect(result).toMatchObject({
      ok: true,
      user: { id: "user-1", email: "creator@alnabiy.app" },
    });
    expect(onboardNewUser).toHaveBeenCalledOnce();
  });

  it("returns 409 when the email is already registered with another password", async () => {
    tryCreateAdminClient.mockReturnValue(
      adminClient({
        error: { message: "User already registered", code: "email_exists" },
      })
    );
    const supabase = supabaseClient({
      signIn: {
        data: { user: null },
        error: { message: "Invalid login credentials" },
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ users: [{ id: "user-1", email: "creator@alnabiy.app" }] }),
          { status: 200 }
        )
      )
    );

    const result = await completePasswordAuth({
      supabase: supabase as never,
      email: "creator@alnabiy.app",
      password: "wrong-pass",
      register: true,
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: PUBLIC_AUTH_ERRORS.taken,
    });
  });

  it("returns a generic 401 on wrong password", async () => {
    tryCreateAdminClient.mockReturnValue(null);
    const supabase = supabaseClient({
      signIn: {
        data: { user: null },
        error: { message: "Invalid login credentials" },
      },
    });

    const result = await completePasswordAuth({
      supabase: supabase as never,
      email: "creator@alnabiy.app",
      password: "nope",
      register: false,
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: PUBLIC_AUTH_ERRORS.invalid,
    });
  });

  it("confirms an unconfirmed email and retries sign-in", async () => {
    tryCreateAdminClient.mockReturnValue(adminClient());
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ users: [{ id: "user-1", email: "creator@alnabiy.app" }] }),
          { status: 200 }
        )
      )
    );
    const supabase = supabaseClient({
      signIn: {
        data: { user: null },
        error: { code: "email_not_confirmed", message: "Email not confirmed" },
      },
      signInRetry: { data: { user: identity }, error: null },
    });

    const result = await completePasswordAuth({
      supabase: supabase as never,
      email: "creator@alnabiy.app",
      password: "secret1",
      register: false,
    });

    expect(result.ok).toBe(true);
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(2);
  });

  it("blocks a banned ledger account", async () => {
    tryCreateAdminClient.mockReturnValue(null);
    onboardNewUser.mockResolvedValue({
      user: { ...ledger, status: "BANNED" },
      isNew: false,
    });
    const supabase = supabaseClient({
      signIn: { data: { user: identity }, error: null },
    });

    const result = await completePasswordAuth({
      supabase: supabase as never,
      email: "creator@alnabiy.app",
      password: "secret1",
      register: false,
    });

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: PUBLIC_AUTH_ERRORS.banned,
    });
  });
});
