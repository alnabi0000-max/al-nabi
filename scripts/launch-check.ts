/**
 * Secretlarni chiqarmaydigan launch preflight.
 * Ishlatish: npm run launch:check [-- --json]
 */

import fs from "fs";
import path from "path";
import {
  evaluateLaunchChecklist,
  missingLaunchChecks,
  missingLaunchEnvNames,
} from "../src/lib/launch/checklist";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
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

const root = process.cwd();
loadEnvFile(path.join(root, ".env"));
loadEnvFile(path.join(root, ".env.local"));

const checks = evaluateLaunchChecklist();
const missing = missingLaunchChecks(checks);
const missingEnv = missingLaunchEnvNames(checks);
const json = process.argv.includes("--json");

if (json) {
  console.log(
    JSON.stringify({
      ready: missing.length === 0,
      missingEnv,
      checks: checks.map(({ id, ok, hint, env }) => ({ id, ok, hint, env })),
    })
  );
} else {
  console.log("\nAl-Nabi — ochish tekshiruvi\n");
  for (const c of checks) {
    const mark = c.ok ? "OK " : "YOQ";
    console.log(`${mark}  ${c.title}`);
    if (!c.ok) console.log(`     → ${c.hint}`);
    if (!c.ok && c.env.length) {
      console.log(`     → ${c.env.join(", ")}`);
    }
  }

  console.log("");
  if (missing.length === 0) {
    console.log(
      "Preflight muvaffaqiyatli. Hali staging E2E va rollout dalillari talab qilinadi."
    );
  } else {
    console.log(`Hali ${missing.length} ta reliz sozlamasi yetishmayapti.`);
    console.log(
      "Qiymatlarni faqat hostingning encrypted secret store'iga qo‘ying, keyin yana: npm run launch:check\n"
    );
  }
}

process.exitCode = missing.length === 0 ? 0 : 1;
