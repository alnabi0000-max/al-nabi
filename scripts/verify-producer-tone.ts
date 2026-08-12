/**
 * Verify Producer Chat premium tone wiring + clamp behavior.
 * Optional live LLM turns if OPENROUTER_API_KEY is set.
 * Run: npx tsx scripts/verify-producer-tone.ts
 */
import {
  buildProducerSystemPrompt,
  clampProducerReply,
  runProducerChat,
} from "../src/lib/producer/chat";
import { getOpenRouterApiKey } from "../src/lib/ai/openrouter";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const prompt = buildProducerSystemPrompt({
  level: "beginner",
  lang: "uz-Latn",
  mode: "producer",
  clientContext: `- Ism: Jasur\n- Kredit qolgan (NC): 120`,
});

assert(prompt.includes("PREMIUM TONE LAW"), "producer prompt must include PREMIUM TONE LAW");
assert(prompt.includes("NO EMPTY PRAISE"), "must forbid empty praise");
assert(prompt.includes("HONEST ADVICE"), "must include honest advice");
assert(prompt.includes("IF THE CLIENT INSISTS"), "must include insistence handling");
assert(
  !prompt.includes("Al-Nabi mas'ul emas") ||
    prompt.includes("FORBIDDEN phrasings"),
  "liability dodge must be forbidden, not instructed"
);
assert(prompt.includes("Jasur"), "client name must appear in prompt context");
assert(
  prompt.includes("personalize sparingly"),
  "name personalization hint required"
);

const soft = clampProducerReply(
  "Albatta, Jasur — shu yo‘nalishda davom etamiz. Natija biroz boshqacha chiqsa, keyin birga yaxshilab olamiz."
);
assert(soft.startsWith("Albatta"), "clamp must keep soft-assent Albatta");

const converse = buildProducerSystemPrompt({
  level: "beginner",
  lang: "uz-Latn",
  mode: "converse",
  clientContext: `- Ism: Jasur\n- Kredit qolgan (NC): 120`,
});
assert(converse.includes("PREMIUM TONE LAW"), "converse mode also gets premium tone");

console.log("OK — premium tone wiring + clamp");

async function liveSmoke() {
  if (!getOpenRouterApiKey()) {
    console.log("SKIP live chat — no OPENROUTER_API_KEY");
    return;
  }

  const vague = await runProducerChat({
    messages: [
      {
        role: "user",
        content: "video qil, chiroyli bo‘lsin",
      },
    ],
    locale: "Uzbek",
    localeCode: "uz",
    clientContext: `- Ism: Jasur\n- Kredit qolgan (NC): 120`,
  });
  console.log("\n--- LIVE: vague brief ---");
  console.log("mode:", vague.mode);
  console.log("reply:", vague.reply);

  const insist = await runProducerChat({
    messages: [
      {
        role: "user",
        content: "video qil, chiroyli bo‘lsin",
      },
      {
        role: "assistant",
        content: vague.reply,
      },
      {
        role: "user",
        content: "yo‘q, aynan shunday xohlayman — shu qisqa prompt bilan qil",
      },
    ],
    locale: "Uzbek",
    localeCode: "uz",
    clientContext: `- Ism: Jasur\n- Kredit qolgan (NC): 120`,
  });
  console.log("\n--- LIVE: client insists ---");
  console.log("mode:", insist.mode);
  console.log("reply:", insist.reply);
  console.log("showProduce brief:", insist.productionBrief?.slice(0, 120) || "(none)");
}

liveSmoke().catch((e) => {
  console.error("live smoke failed", e);
  process.exitCode = 1;
});
