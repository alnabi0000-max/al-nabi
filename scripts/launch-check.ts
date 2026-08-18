/**
 * Ochish tekshiruvi — .env.local dagi kalitlar to‘liqmi?
 * Ishlatish: npm run launch:check
 */

import fs from "fs";
import path from "path";
import {
  evaluateLaunchChecklist,
  missingLaunchChecks,
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

console.log("\nAl-Nabi — ochish tekshiruvi\n");
for (const c of checks) {
  const mark = c.ok ? "OK " : "YOQ";
  console.log(`${mark}  ${c.title}`);
  if (!c.ok) console.log(`     → ${c.hint}`);
}

console.log("");
if (missing.length === 0) {
  console.log(
    "Kalitlar to‘liq. Qolgani: 2 ta qo‘lda ish — real video sinovi va support pochta."
  );
  process.exit(0);
}

console.log(`Hali ${missing.length} ta kalit/sozlama yetishmayapti.`);
console.log(
  "Bularni .env.local (yoki hosting) ga qo‘ying, keyin yana: npm run launch:check\n"
);
process.exit(1);
