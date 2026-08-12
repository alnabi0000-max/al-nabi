/**
 * Smoke-test Producer Chat tools: shablon_tanla + sahifaga_yonaltir
 * Run: npx tsx --env-file=.env.local scripts/test-producer-tools.ts
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvFile(name: string) {
  const p = resolve(process.cwd(), name);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

async function main() {
  const { matchTemplateForIdea, runProducerChat } = await import(
    "../src/lib/producer/chat"
  );

  const local = matchTemplateForIdea("Men kinematik uslubda video qilmoqchiman");
  console.log(
    "LOCAL match:",
    local
      ? `${local.id} · ${local.title} · ${local.category}`
      : "NONE"
  );
  if (!local || local.category !== "Cinematic") {
    console.error("FAIL: expected a Cinematic template locally");
    process.exit(1);
  }

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("FAIL: OPENROUTER_API_KEY missing");
    process.exit(1);
  }

  const result = await runProducerChat({
    messages: [
      {
        role: "user",
        content: "Men kinematik uslubda video qilmoqchiman",
      },
    ],
    locale: "Uzbek",
    localeCode: "uz",
  });

  console.log("reply:", result.reply);
  console.log("mode:", result.mode);
  console.log("language:", result.language);
  console.log(
    "actions:",
    result.quickActions.map((a) => {
      if (a.id === "select_template") {
        return `${a.id}:${a.templateId}:${a.templateTitle}`;
      }
      if ("href" in a) return `${a.id}:${a.href}`;
      return a.id;
    })
  );

  const select = result.quickActions.find((a) => a.id === "select_template");
  if (!select || select.id !== "select_template") {
    console.error("FAIL: expected select_template quick action from tool use");
    process.exit(1);
  }

  const tpl = matchTemplateForIdea("kinematik");
  if (tpl && select.templateId) {
    console.log("OK select_template →", select.templateTitle, select.templateId);
  }

  console.log("PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
