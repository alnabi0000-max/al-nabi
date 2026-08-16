/**
 * Environment classification for fail-closed production vs local development.
 *
 * `next build` sets NODE_ENV=production even on a developer laptop. Secret
 * enforcement belongs at production runtime (and CI/Vercel builds), never at
 * `NODE_ENV === "development"` — placeholder / mock Supabase keys must compile.
 */

export function isProductionNodeEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isDevelopmentNodeEnv(): boolean {
  return process.env.NODE_ENV === "development";
}

function isCiOrHostedBuild(): boolean {
  const ci = (process.env.CI || "").toLowerCase();
  return process.env.VERCEL === "1" || ci === "true" || ci === "1";
}

/**
 * True only when missing/placeholder secrets must crash the process.
 * Local `next build` (`NEXT_PHASE=phase-production-build` without CI/Vercel)
 * is excluded so developers can compile against `.env` placeholders.
 */
export function shouldEnforceProductionSecrets(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  if (
    process.env.NEXT_PHASE === "phase-production-build" &&
    !isCiOrHostedBuild()
  ) {
    return false;
  }
  return true;
}

/** Mock / example values that must never be treated as live credentials. */
export function isPlaceholderEnvValue(
  value: string | undefined | null
): boolean {
  const v = (value || "").trim();
  if (!v) return true;
  const lower = v.toLowerCase();
  if (
    v.includes("[ref]") ||
    v.includes("[PROJECT_REF]") ||
    v.includes("...") ||
    /\[.+\]/.test(v)
  ) {
    return true;
  }
  return (
    lower.includes("placeholder") ||
    lower.includes("changeme") ||
    lower.includes("change-me") ||
    lower.includes("your-project") ||
    lower.includes("your_project") ||
    lower.includes("example.supabase") ||
    lower.includes("buildcheck.supabase")
  );
}
