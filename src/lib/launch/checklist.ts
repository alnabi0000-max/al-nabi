import {
  isPlaceholderEnvValue,
  shouldEnforceProductionSecrets,
} from "@/lib/env";

export type LaunchCheckId =
  | "database"
  | "auth"
  | "stripe"
  | "video"
  | "voice"
  | "chat"
  | "jobs"
  | "storage"
  | "rate_limit"
  | "app_url";

export type LaunchCheck = {
  id: LaunchCheckId;
  /** Simple Uzbek label for operators */
  title: string;
  ok: boolean;
  hint: string;
};

function val(name: string): string {
  return process.env[name]?.trim() || "";
}

function present(name: string): boolean {
  return !isPlaceholderEnvValue(val(name));
}

function hasObjectStorage(): boolean {
  const r2 =
    present("R2_ACCOUNT_ID") &&
    present("R2_ACCESS_KEY_ID") &&
    present("R2_SECRET_ACCESS_KEY") &&
    present("R2_BUCKET");
  const s3 =
    present("AWS_ACCESS_KEY_ID") &&
    present("AWS_SECRET_ACCESS_KEY") &&
    Boolean(val("AWS_S3_BUCKET") || val("S3_BUCKET"));
  return r2 || s3;
}

function stripeOk(): boolean {
  const secret = val("STRIPE_SECRET_KEY");
  const pub = val("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  const wh = val("STRIPE_WEBHOOK_SECRET");
  if (isPlaceholderEnvValue(secret) || !secret.startsWith("sk_")) return false;
  if (isPlaceholderEnvValue(pub) || !pub.startsWith("pk_")) return false;
  if (isPlaceholderEnvValue(wh) || !wh.startsWith("whsec_")) return false;
  return true;
}

function authOk(): boolean {
  const mode = val("AUTH_MODE").toLowerCase();
  const url = val("NEXT_PUBLIC_SUPABASE_URL");
  const anon = val("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const secret = val("AUTH_SECRET") || val("NEXTAUTH_SECRET");
  if (mode && mode !== "supabase") return false;
  if (isPlaceholderEnvValue(url) || !url.startsWith("https://")) return false;
  if (isPlaceholderEnvValue(anon)) return false;
  if (isPlaceholderEnvValue(secret) || secret.length < 32) return false;
  return true;
}

function appUrlOk(): boolean {
  const url = val("NEXT_PUBLIC_APP_URL");
  if (isPlaceholderEnvValue(url)) return false;
  return url.startsWith("https://") || url.startsWith("http://localhost");
}

/** Read-only snapshot of what is still missing before public launch. */
export function evaluateLaunchChecklist(): LaunchCheck[] {
  return [
    {
      id: "database",
      title: "Ma’lumotlar bazasi",
      ok: present("DATABASE_URL") && val("DATABASE_URL").includes("postgres"),
      hint: "Supabase Postgres: DATABASE_URL va DIRECT_URL",
    },
    {
      id: "auth",
      title: "Kirish (Google / Apple / email)",
      ok: authOk(),
      hint: "AUTH_MODE=supabase, Supabase URL/kalit, AUTH_SECRET (32+ belgi)",
    },
    {
      id: "stripe",
      title: "To‘lov (NC paketlar)",
      ok: stripeOk(),
      hint: "STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET",
    },
    {
      id: "video",
      title: "Video va rasm",
      ok: present("REPLICATE_API_KEY") && val("REPLICATE_API_KEY").startsWith("r8_"),
      hint: "REPLICATE_API_KEY (r8_…)",
    },
    {
      id: "voice",
      title: "Ovoz (TTS)",
      ok: present("ELEVENLABS_API_KEY"),
      hint: "ELEVENLABS_API_KEY",
    },
    {
      id: "chat",
      title: "Chat va matn",
      ok: present("OPENROUTER_API_KEY") && val("OPENROUTER_API_KEY").startsWith("sk-or-"),
      hint: "OPENROUTER_API_KEY",
    },
    {
      id: "jobs",
      title: "Fon ishlar (navbat)",
      ok: present("INNGEST_EVENT_KEY") && present("INNGEST_SIGNING_KEY"),
      hint: "INNGEST_EVENT_KEY va INNGEST_SIGNING_KEY",
    },
    {
      id: "storage",
      title: "Video saqlash",
      ok: hasObjectStorage(),
      hint: "To‘liq R2 yoki S3 kalitlari (R2_BUCKET yoki AWS_S3_BUCKET)",
    },
    {
      id: "rate_limit",
      title: "Himoya (so‘rov limiti)",
      ok: present("UPSTASH_REDIS_REST_URL") && present("UPSTASH_REDIS_REST_TOKEN"),
      hint: "UPSTASH_REDIS_REST_URL va UPSTASH_REDIS_REST_TOKEN",
    },
    {
      id: "app_url",
      title: "Sayt manzili",
      ok: appUrlOk(),
      hint: "NEXT_PUBLIC_APP_URL = https://sizning-domen",
    },
  ];
}

export function missingLaunchChecks(
  checks: LaunchCheck[] = evaluateLaunchChecklist()
): LaunchCheck[] {
  return checks.filter((c) => !c.ok);
}

/**
 * Production server must not boot half-configured (mock video, unpaid storage).
 * Local `next build` on a laptop is excluded via shouldEnforceProductionSecrets.
 */
export function assertProductionLaunchConfiguration(): void {
  if (!shouldEnforceProductionSecrets()) return;
  const missing = missingLaunchChecks();
  if (!missing.length) return;
  const lines = missing.map((c) => `${c.title}: ${c.hint}`).join("; ");
  throw new Error(
    `Sayt ochishga tayyor emas. Yetishmayapti: ${lines}`
  );
}
