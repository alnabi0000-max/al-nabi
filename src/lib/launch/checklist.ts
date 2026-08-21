import {
  isPlaceholderEnvValue,
  shouldEnforceProductionSecrets,
} from "@/lib/env";

export type LaunchCheckId =
  | "runtime"
  | "database"
  | "auth"
  | "stripe"
  | "video"
  | "voice"
  | "chat"
  | "jobs"
  | "storage"
  | "rate_limit"
  | "app_url"
  | "operations"
  | "safety"
  | "release_guard"
  | "observability"
  | "email";

export type LaunchCheck = {
  id: LaunchCheckId;
  /** Simple Uzbek label for operators */
  title: string;
  ok: boolean;
  hint: string;
  /** Variable names to set or remove. Never includes values. */
  env: string[];
};

function val(name: string): string {
  return process.env[name]?.trim() || "";
}

function present(name: string): boolean {
  return !isPlaceholderEnvValue(val(name));
}

/**
 * Keep the runtime requirement aligned with package.json's Node engine range
 * without exposing any deployment configuration.
 */
export function isSupportedNodeRuntime(
  version = process.versions.node
): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major === 22 && minor >= 13;
}

function storageMissing(): string[] {
  const r2Names = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
  ];
  const s3Names = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];
  const s3BucketPresent = present("AWS_S3_BUCKET") || present("S3_BUCKET");
  const r2Complete = r2Names.every(present);
  const s3Complete = s3Names.every(present) && s3BucketPresent;
  if (r2Complete || s3Complete) return [];

  const r2Started = r2Names.some(present);
  const s3Started = s3Names.some(present) || s3BucketPresent;
  if (s3Started && !r2Started) {
    const missing = s3Names.filter((name) => !present(name));
    if (!s3BucketPresent) missing.push("AWS_S3_BUCKET");
    return missing;
  }
  return r2Names.filter((name) => !present(name));
}

function missingIfAbsent(names: string[]): string[] {
  return names.filter((name) => !present(name));
}

function stripeMissing(): string[] {
  const missing: string[] = [];
  const secret = val("STRIPE_SECRET_KEY");
  const pub = val("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  const wh = val("STRIPE_WEBHOOK_SECRET");
  if (isPlaceholderEnvValue(secret) || !secret.startsWith("sk_")) {
    missing.push("STRIPE_SECRET_KEY");
  }
  if (isPlaceholderEnvValue(pub) || !pub.startsWith("pk_")) {
    missing.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  }
  if (isPlaceholderEnvValue(wh) || !wh.startsWith("whsec_")) {
    missing.push("STRIPE_WEBHOOK_SECRET");
  }
  return missing;
}

function authMissing(): string[] {
  const missing: string[] = [];
  const mode = val("AUTH_MODE").toLowerCase();
  const url = val("NEXT_PUBLIC_SUPABASE_URL");
  const anon = val("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const secret = val("AUTH_SECRET") || val("NEXTAUTH_SECRET");
  if (mode && mode !== "supabase") missing.push("AUTH_MODE");
  if (isPlaceholderEnvValue(url) || !url.startsWith("https://")) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (isPlaceholderEnvValue(anon)) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (isPlaceholderEnvValue(secret) || secret.length < 32) {
    missing.push("AUTH_SECRET");
  }
  return missing;
}

function appUrlMissing(): string[] {
  const url = val("NEXT_PUBLIC_APP_URL");
  if (
    isPlaceholderEnvValue(url) ||
    !(url.startsWith("https://") || url.startsWith("http://localhost"))
  ) {
    return ["NEXT_PUBLIC_APP_URL"];
  }
  return [];
}

function safetyMissing(): string[] {
  const missing: string[] = [];
  if (val("SAFETY_FAIL_CLOSED") !== "1") missing.push("SAFETY_FAIL_CLOSED");
  const referenceMediaMode = val("SAFETY_REFERENCE_MEDIA_MODE").toLowerCase();
  if (referenceMediaMode !== "review" && referenceMediaMode !== "block") {
    missing.push("SAFETY_REFERENCE_MEDIA_MODE");
  }
  return missing;
}

function releaseGuardEnv(): string[] {
  const extra: string[] = [];
  if (val("NEXT_PUBLIC_AUTH_MODE").toLowerCase() === "local") {
    extra.push("NEXT_PUBLIC_AUTH_MODE");
  }
  for (const name of ["R2_PUBLIC_URL", "AWS_S3_PUBLIC_URL", "S3_PUBLIC_URL"]) {
    if (present(name)) extra.push(name);
  }
  for (const name of [
    "ALNABIY_DEV_AUTH_BYPASS",
    "ALLOW_DEMO_CHECKOUT",
    "ALLOW_SOFT_CREDITS",
    "ALNABIY_FORCE_MOCK",
    "ALNABIY_ALLOW_AUDIO_MOCK",
  ]) {
    if (val(name) === "1") extra.push(name);
  }
  return extra;
}

function videoMissing(): string[] {
  const key = val("REPLICATE_API_KEY");
  if (isPlaceholderEnvValue(key) || !key.startsWith("r8_")) {
    return ["REPLICATE_API_KEY"];
  }
  return [];
}

function chatMissing(): string[] {
  const key = val("OPENROUTER_API_KEY");
  if (isPlaceholderEnvValue(key) || !key.startsWith("sk-or-")) {
    return ["OPENROUTER_API_KEY"];
  }
  return [];
}

function observabilityMissing(): string[] {
  const dsn = val("NEXT_PUBLIC_SENTRY_DSN");
  if (isPlaceholderEnvValue(dsn) || !dsn.startsWith("https://")) {
    return ["NEXT_PUBLIC_SENTRY_DSN"];
  }
  return [];
}

function databaseMissing(): string[] {
  const missing: string[] = [];
  if (!present("DATABASE_URL") || !val("DATABASE_URL").includes("postgres")) {
    missing.push("DATABASE_URL");
  }
  if (!present("DIRECT_URL") || !val("DIRECT_URL").includes("postgres")) {
    missing.push("DIRECT_URL");
  }
  return missing;
}

function check(
  id: LaunchCheckId,
  title: string,
  hint: string,
  env: string[],
  ok = env.length === 0
): LaunchCheck {
  return { id, title, hint, env, ok };
}

/** Read-only snapshot of what is still missing before public launch. */
export function evaluateLaunchChecklist(
  nodeVersion = process.versions.node
): LaunchCheck[] {
  const runtimeOk = isSupportedNodeRuntime(nodeVersion);
  const authEnv = authMissing();
  const stripeEnv = stripeMissing();
  const videoEnv = videoMissing();
  const voiceEnv = missingIfAbsent(["ELEVENLABS_API_KEY"]);
  const chatEnv = chatMissing();
  const jobsEnv = missingIfAbsent(["INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY"]);
  const storageEnv = storageMissing();
  const rateLimitEnv = missingIfAbsent([
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ]);
  const operationsEnv = missingIfAbsent([
    "ADMIN_API_SECRET",
    "CRON_SECRET",
    "ALNABIY_OBFUSCATE_SECRET",
  ]);
  const safetyEnv = safetyMissing();
  const releaseEnv = releaseGuardEnv();
  const observabilityEnv = observabilityMissing();
  const emailEnv = missingIfAbsent(["RESEND_API_KEY", "RESEND_FROM_EMAIL"]);
  const databaseEnv = databaseMissing();
  const appUrlEnv = appUrlMissing();

  return [
    check(
      "runtime",
      "Node.js muhiti",
      `Node 22.13.x kerak (topildi: ${nodeVersion})`,
      [],
      runtimeOk
    ),
    check(
      "database",
      "Ma’lumotlar bazasi",
      "Supabase Postgres: DATABASE_URL (pooled runtime) va DIRECT_URL (direct migration)",
      databaseEnv
    ),
    check(
      "auth",
      "Kirish (Google / Apple / email)",
      "AUTH_MODE=supabase, Supabase URL/kalit, AUTH_SECRET (32+ belgi)",
      authEnv
    ),
    check(
      "stripe",
      "To‘lov (NC paketlar)",
      "STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET",
      stripeEnv
    ),
    check("video", "Video va rasm", "REPLICATE_API_KEY (r8_…)", videoEnv),
    check("voice", "Ovoz (TTS)", "ELEVENLABS_API_KEY", voiceEnv),
    check("chat", "Chat va matn", "OPENROUTER_API_KEY", chatEnv),
    check(
      "jobs",
      "Fon ishlar (navbat)",
      "INNGEST_EVENT_KEY va INNGEST_SIGNING_KEY",
      jobsEnv
    ),
    check(
      "storage",
      "Video saqlash",
      "To‘liq R2 yoki S3 kalitlari (R2_BUCKET yoki AWS_S3_BUCKET)",
      storageEnv
    ),
    check(
      "rate_limit",
      "Himoya (so‘rov limiti)",
      "UPSTASH_REDIS_REST_URL va UPSTASH_REDIS_REST_TOKEN",
      rateLimitEnv
    ),
    check(
      "operations",
      "Operatsion himoya",
      "ADMIN_API_SECRET, CRON_SECRET va ALNABIY_OBFUSCATE_SECRET (placeholder emas)",
      operationsEnv
    ),
    check(
      "safety",
      "Ishonch va xavfsizlik",
      "SAFETY_FAIL_CLOSED=1 va SAFETY_REFERENCE_MEDIA_MODE=review yoki block",
      safetyEnv
    ),
    check(
      "release_guard",
      "Reliz himoyasi",
      "Public media URL va local/demo/mock/bypass sozlamalarini olib tashlang",
      releaseEnv
    ),
    check(
      "observability",
      "Kuzatuv va ogohlantirish",
      "NEXT_PUBLIC_SENTRY_DSN (HTTPS, placeholder emas)",
      observabilityEnv
    ),
    check(
      "email",
      "Tranzaksion pochta",
      "RESEND_API_KEY va RESEND_FROM_EMAIL (placeholder emas)",
      emailEnv
    ),
    check(
      "app_url",
      "Sayt manzili",
      "NEXT_PUBLIC_APP_URL = https://sizning-domen",
      appUrlEnv
    ),
  ];
}

export function missingLaunchChecks(
  checks: LaunchCheck[] = evaluateLaunchChecklist()
): LaunchCheck[] {
  return checks.filter((c) => !c.ok);
}

/** Unique env names that failed a check. Values are never included. */
export function missingLaunchEnvNames(
  checks: LaunchCheck[] = evaluateLaunchChecklist()
): string[] {
  return [...new Set(checks.filter((c) => !c.ok).flatMap((c) => c.env))];
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
