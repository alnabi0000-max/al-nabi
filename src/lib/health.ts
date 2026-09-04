import { getAuthMode, isSupabaseConfigured, type AuthMode } from "@/lib/auth/config";
import { isInngestConfigured } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import {
  isUpstashConfigured,
  pingUpstash,
} from "@/lib/security/upstash-config";

export type HealthReport = {
  ok: boolean;
  service: "al-nabi";
  database: boolean;
  auth: {
    mode: AuthMode;
    supabase: boolean;
  };
  queue: {
    inngest: boolean;
    mode: "inngest" | "local";
  };
  rateLimit: {
    upstash: boolean;
    reachable: boolean | null;
  };
};

/**
 * Liveness + Prisma connectivity. Queue/Redis are reported but never fail
 * local health — development can run without Upstash. Never includes secrets.
 */
export async function getHealthReport(): Promise<HealthReport> {
  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }

  let mode: AuthMode = "local";
  let supabase = false;
  try {
    mode = getAuthMode();
    supabase = isSupabaseConfigured();
  } catch {
    mode = "supabase";
    supabase = false;
  }

  const inngest = isInngestConfigured();
  const upstash = isUpstashConfigured();
  const reachable = await pingUpstash();

  return {
    ok: database,
    service: "al-nabi",
    database,
    auth: { mode, supabase },
    queue: {
      inngest,
      mode: inngest ? "inngest" : "local",
    },
    rateLimit: {
      upstash,
      reachable,
    },
  };
}
