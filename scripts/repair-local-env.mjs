/**
 * Cleans .env.local (encoding, mixed-project keys, placeholders) and turns
 * Google OAuth on in the Supabase project that NEXT_PUBLIC_SUPABASE_URL points
 * at. Never prints secret values.
 *
 * Run: node scripts/repair-local-env.mjs
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(".env.local");
const WORD_LOCK = resolve("~$.env.local");

function stripInlineComment(value) {
  const hash = value.search(/\s+#/);
  if (hash >= 0) return value.slice(0, hash).trim();
  const glued = value.match(/^([^#]+)#\s+.+$/);
  if (glued) return glued[1].trim();
  return value;
}

function parseEnvFile(filePath) {
  const map = new Map();
  if (!existsSync(filePath)) return map;
  const raw = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = stripInlineComment(trimmed.slice(eq + 1).trim());
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value.trim());
  }
  return map;
}

function isJunk(value) {
  const v = (value || "").trim();
  if (!v) return true;
  const lower = v.toLowerCase();
  if (/^\*+$/.test(v)) return true;
  if (lower.includes("your_") && lower.endsWith("_here")) return true;
  if (lower.includes("changeme") || lower.includes("change-me")) return true;
  return false;
}

function quoteEnv(value) {
  if (/[\s#"']/.test(value) || value.includes("=")) {
    return JSON.stringify(value);
  }
  return value;
}

function jwtRef(token) {
  try {
    const payload = String(token).split(".")[1];
    if (!payload) return "";
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof json.ref === "string" ? json.ref : "";
  } catch {
    return "";
  }
}

function projectRef(url) {
  try {
    return new URL(url).hostname.replace(/\.supabase\.co$/i, "");
  } catch {
    return "";
  }
}

function mergeAllowList(current, extras) {
  const set = new Set(
    String(current || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  for (const extra of extras) {
    if (extra) set.add(extra);
  }
  return [...set].join(",");
}

function writeEnv(map) {
  const get = (key) => {
    const v = map.get(key);
    return v && !isJunk(v) ? v : "";
  };
  const line = (key) => {
    const v = get(key);
    return v ? `${key}=${quoteEnv(v)}` : null;
  };
  const block = (title, keys) => {
    const rows = keys.map(line).filter(Boolean);
    if (!rows.length) return [];
    return [`# ${title}`, ...rows, ""];
  };

  const known = new Set([
    "AUTH_MODE",
    "AUTH_SECRET",
    "NEXT_PUBLIC_APP_NAME",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_CREDITS_PER_MINUTE",
    "NEXT_PUBLIC_ALNABIY_MODE",
    "DATABASE_URL",
    "DIRECT_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ACCESS_TOKEN",
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "OPENROUTER_API_KEY",
    "OPENAI_MODEL",
    "OPENAI_MODERATION_MODEL",
    "REPLICATE_API_KEY",
    "ELEVENLABS_API_KEY",
    "ELEVENLABS_VOICE_ID",
    "ELEVENLABS_MODEL",
    "INNGEST_EVENT_KEY",
    "INNGEST_SIGNING_KEY",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_ADMIN_CHAT_ID",
    "NEXT_PUBLIC_SENTRY_DSN",
    "SENTRY_DSN",
    "ADMIN_MASTER_PASSCODE",
    "ADMIN_API_SECRET",
    "CRON_SECRET",
    "ALNABIY_OBFUSCATE_SECRET",
    "MODERATION_FAIL_CLOSED",
    "SAFETY_FAIL_CLOSED",
    "SAFETY_REFERENCE_MEDIA_MODE",
    "STORAGE_DIR",
  ]);

  const extras = [];
  for (const [key, value] of map) {
    if (known.has(key) || isJunk(value)) continue;
    extras.push(`${key}=${quoteEnv(value)}`);
  }

  const body = [
    "# Al-Nabi — local environment (UTF-8). Do not open this file in Word.",
    "# Google sign-in: Supabase Auth + Google Cloud Web OAuth client.",
    "",
    ...block("App", [
      "AUTH_MODE",
      "AUTH_SECRET",
      "NEXT_PUBLIC_APP_NAME",
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_CREDITS_PER_MINUTE",
      "NEXT_PUBLIC_ALNABIY_MODE",
    ]),
    ...block("Database (Prisma)", ["DATABASE_URL", "DIRECT_URL"]),
    ...block("Supabase Auth (URL, anon, and service_role MUST be the same project)", [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_ACCESS_TOKEN",
    ]),
    ...block("Google OAuth (Management API + Google Cloud Web client)", [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
    ]),
    ...block("Stripe", [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    ]),
    ...block("AI / media", [
      "OPENROUTER_API_KEY",
      "OPENAI_MODEL",
      "OPENAI_MODERATION_MODEL",
      "REPLICATE_API_KEY",
      "ELEVENLABS_API_KEY",
      "ELEVENLABS_VOICE_ID",
      "ELEVENLABS_MODEL",
    ]),
    ...block("Jobs / storage / email / limits", [
      "INNGEST_EVENT_KEY",
      "INNGEST_SIGNING_KEY",
      "STORAGE_DIR",
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET",
      "RESEND_API_KEY",
      "RESEND_FROM_EMAIL",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ]),
    ...block("Admin / safety / monitoring", [
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_ADMIN_CHAT_ID",
      "NEXT_PUBLIC_SENTRY_DSN",
      "SENTRY_DSN",
      "ADMIN_MASTER_PASSCODE",
      "ADMIN_API_SECRET",
      "CRON_SECRET",
      "ALNABIY_OBFUSCATE_SECRET",
      "MODERATION_FAIL_CLOSED",
      "SAFETY_FAIL_CLOSED",
      "SAFETY_REFERENCE_MEDIA_MODE",
    ]),
    extras.length ? ["# Other", ...extras, ""].join("\n") : "",
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
    .concat("\n");

  writeFileSync(ENV_PATH, body, { encoding: "utf8" });
}

const env = parseEnvFile(ENV_PATH);
if (!env.size) {
  console.error(".env.local is missing or empty.");
  process.exit(1);
}

if (existsSync(WORD_LOCK)) {
  try {
    unlinkSync(WORD_LOCK);
    console.log("Removed Word lock file ~$.env.local");
  } catch {
    console.warn("Could not remove ~$.env.local (close Word if it is open).");
  }
}

const supabaseUrl = (env.get("NEXT_PUBLIC_SUPABASE_URL") || "")
  .trim()
  .replace(/\/$/, "");
const ref = projectRef(supabaseUrl);
const anonRef = jwtRef(env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") || "");
const serviceRef = jwtRef(env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
const accessToken = (env.get("SUPABASE_ACCESS_TOKEN") || "").trim();
const clientId = (env.get("GOOGLE_OAUTH_CLIENT_ID") || "").trim();
const clientSecret = (env.get("GOOGLE_OAUTH_CLIENT_SECRET") || "").trim();
const appUrl =
  (env.get("NEXT_PUBLIC_APP_URL") || "").trim().replace(/\/$/, "") ||
  "http://localhost:3000";

console.log(`Canonical Supabase project: ${ref || "(missing URL)"}`);
console.log(`Anon key project: ${anonRef || "(unreadable)"}`);
console.log(`Service-role key project: ${serviceRef || "(unreadable)"}`);
if (ref && anonRef && ref !== anonRef) {
  console.warn("Anon key is from a different project than NEXT_PUBLIC_SUPABASE_URL.");
}
if (ref && serviceRef && ref !== serviceRef) {
  console.warn("Service-role key is from a different project — will replace if Management API allows.");
}

if (!ref || !supabaseUrl.startsWith("http")) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is invalid.");
  process.exit(1);
}

env.set("AUTH_MODE", "supabase");
env.set("NEXT_PUBLIC_APP_URL", appUrl);
if (env.get("TELEGRAM_ADMIN_CHAT_ID")) {
  env.set("TELEGRAM_ADMIN_CHAT_ID", env.get("TELEGRAM_ADMIN_CHAT_ID").trim());
}

const headers = {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
};

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

if (accessToken) {
  const projects = await fetchJson("https://api.supabase.com/v1/projects", {
    headers,
  });
  if (!projects.ok) {
    console.warn(
      `Could not list Supabase projects (${projects.status}). Check SUPABASE_ACCESS_TOKEN.`
    );
  } else {
    const names = Array.isArray(projects.json)
      ? projects.json.map((p) => p.ref).filter(Boolean)
      : [];
    console.log(
      names.includes(ref)
        ? `Access token can see project ${ref}.`
        : `Access token does not list ${ref}. Visible projects: ${names.length}.`
    );
  }

  const keysRes = await fetchJson(
    `https://api.supabase.com/v1/projects/${ref}/api-keys`,
    { headers }
  );
  if (keysRes.ok && Array.isArray(keysRes.json)) {
    for (const row of keysRes.json) {
      const name = String(row.name || row.id || "").toLowerCase();
      const key = row.api_key || row.apiKey || row.key;
      if (!key || typeof key !== "string") continue;
      if (name.includes("anon") || name === "legacyanon") {
        env.set("NEXT_PUBLIC_SUPABASE_ANON_KEY", key);
      }
      if (name.includes("service")) {
        env.set("SUPABASE_SERVICE_ROLE_KEY", key);
      }
    }
    const syncedAnon = jwtRef(env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") || "");
    const syncedSr = jwtRef(env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    console.log(`Synced API keys. anon=${syncedAnon || "?"} service_role=${syncedSr || "?"}`);
  } else {
    console.warn(`Could not fetch API keys (${keysRes.status}).`);
  }
} else {
  console.warn("SUPABASE_ACCESS_TOKEN is missing — cannot sync keys or enable Google via API.");
}

writeEnv(env);
console.log("Wrote a clean UTF-8 .env.local");

if (!clientId || !clientSecret) {
  console.error(
    [
      "Google Cloud Client ID/Secret are required.",
      `Authorized redirect URI: ${supabaseUrl}/auth/v1/callback`,
      `Authorized JavaScript origins: ${appUrl} and http://127.0.0.1:3000`,
    ].join("\n")
  );
  process.exit(1);
}
if (!accessToken) process.exit(1);

const configUrl = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const currentRes = await fetchJson(configUrl, { headers });
if (!currentRes.ok) {
  console.error(
    `Could not read Auth config (${currentRes.status}). Check SUPABASE_ACCESS_TOKEN.`
  );
  process.exit(1);
}
const current = currentRes.json || {};
const wasGoogleOn = Boolean(current.external_google_enabled);
const signupWasDisabled = Boolean(current.disable_signup);

const patchRes = await fetchJson(configUrl, {
  method: "PATCH",
  headers,
  body: JSON.stringify({
    disable_signup: false,
    external_google_enabled: true,
    external_google_client_id: clientId,
    external_google_secret: clientSecret,
    site_url: current.site_url || appUrl,
    uri_allow_list: mergeAllowList(current.uri_allow_list, [
      `${appUrl}/**`,
      `${appUrl}/auth/callback`,
      "http://localhost:3000/**",
      "http://localhost:3000/auth/callback",
      "http://127.0.0.1:3000/**",
      "http://127.0.0.1:3000/auth/callback",
    ]),
  }),
});

if (!patchRes.ok) {
  console.error(`Could not enable Google (${patchRes.status}).`);
  process.exit(1);
}

console.log(
  `Google provider: ${wasGoogleOn ? "already on" : "was off"} → enabled on ${ref}.`
);
if (signupWasDisabled) {
  console.log("New-user signup was disabled; it is now allowed (needed for Google register).");
}

const anon = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") || "";
const probe = await fetch(
  `${supabaseUrl}/auth/v1/authorize?provider=google`,
  {
    method: "GET",
    redirect: "manual",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
  }
);
const location = probe.headers.get("location") || "";
let probeHost = "";
try {
  probeHost = location ? new URL(location).hostname : "";
} catch {
  probeHost = "";
}
if (probe.status >= 300 && probe.status < 400 && probeHost.includes("google")) {
  console.log(`GoTrue Google probe OK (${probe.status} → ${probeHost}).`);
} else if (probe.status === 400) {
  console.warn(`GoTrue still reports Google disabled (HTTP ${probe.status}).`);
} else {
  console.warn(`GoTrue Google probe HTTP ${probe.status}${probeHost ? ` → ${probeHost}` : ""}.`);
}

console.log("Google Cloud Web client must include:");
console.log(`  JS origins: ${appUrl}  and  http://127.0.0.1:3000`);
console.log(`  Redirect URI: ${supabaseUrl}/auth/v1/callback`);
console.log("Restart `npm run dev` so Next.js reloads .env.local.");
