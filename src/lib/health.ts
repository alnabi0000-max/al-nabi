import { getAuthMode, isSupabaseConfigured, type AuthMode } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";

export type HealthReport = {
  ok: boolean;
  service: "al-nabi";
  database: boolean;
  auth: {
    mode: AuthMode;
    supabase: boolean;
  };
};

/**
 * Liveness + Prisma connectivity. Never includes connection strings or secrets.
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

  return {
    ok: database,
    service: "al-nabi",
    database,
    auth: { mode, supabase },
  };
}
