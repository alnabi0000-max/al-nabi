/**
 * Turns on Google in the hosted Supabase project once a Google Cloud
 * OAuth Web client exists. Does not print secrets.
 *
 * Required env (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   SUPABASE_ACCESS_TOKEN   (https://supabase.com/dashboard/account/tokens)
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const glued = value.match(/^([^#]+)#\s+.+$/);
    if (glued && !(value.startsWith('"') || value.startsWith("'"))) {
      value = glued[1].trim();
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

function val(name) {
  return (process.env[name] || "").trim();
}

function projectRef(url) {
  try {
    const host = new URL(url).hostname;
    return host.replace(".supabase.co", "");
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

loadEnv(resolve(".env"));
loadEnv(resolve(".env.local"));

const supabaseUrl = val("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const clientId = val("GOOGLE_OAUTH_CLIENT_ID");
const clientSecret = val("GOOGLE_OAUTH_CLIENT_SECRET");
const accessToken = val("SUPABASE_ACCESS_TOKEN");
const appUrl = val("NEXT_PUBLIC_APP_URL").replace(/\/$/, "") || "http://localhost:3000";
const ref = projectRef(supabaseUrl);

if (!supabaseUrl || !ref) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is missing.");
  process.exit(1);
}
if (!clientId || !clientSecret) {
  console.error(
    [
      "Google Cloud Client ID/Secret are required. Google will not issue logins without them.",
      "Create a Web OAuth client, then set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
      `Authorized redirect URI: ${supabaseUrl}/auth/v1/callback`,
      `Authorized JavaScript origins: ${appUrl}`,
    ].join("\n")
  );
  process.exit(1);
}
if (!accessToken) {
  console.error(
    "SUPABASE_ACCESS_TOKEN is missing. Create one at https://supabase.com/dashboard/account/tokens"
  );
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
};
const configUrl = `https://api.supabase.com/v1/projects/${ref}/config/auth`;

const currentRes = await fetch(configUrl, { headers });
if (!currentRes.ok) {
  console.error(`Could not read Auth config (${currentRes.status}). Check SUPABASE_ACCESS_TOKEN.`);
  process.exit(1);
}
const current = await currentRes.json();

const patchRes = await fetch(configUrl, {
  method: "PATCH",
  headers,
  body: JSON.stringify({
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

console.log(`Google OAuth enabled for ${ref}. Sign-in can use Continue with Google.`);
console.log(`Google Cloud redirect URI: ${supabaseUrl}/auth/v1/callback`);
console.log(`Google Cloud JS origins: ${appUrl}  and  http://127.0.0.1:3000`);
