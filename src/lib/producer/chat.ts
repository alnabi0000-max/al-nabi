/**
 * Al-Nabi Producer Chat — Creative Co-Pilot + Site Navigator (white-label).
 * Strict language match: reply in the user's exact language/script.
 */

import {
  getEnhanceModel,
  getOpenRouterApiKey,
  openRouterChat,
  type ChatMessage,
} from "@/lib/ai/openrouter";
import type { VisualDna } from "@/lib/producer/vision-dna";
import type { ProducerMemory } from "@/lib/producer/memory";
import {
  languageLabel,
  resolveChatLanguage,
  type PromptLang,
} from "@/lib/ai/prompt-language";
import { getDictionary, resolveAppLocale } from "@/i18n/dictionary";

export type QuickAction =
  | { id: "aspect_reels"; label: string; aspect: "9:16" }
  | { id: "aspect_youtube"; label: string; aspect: "16:9" }
  | { id: "narration_epic"; label: string; narration: "epic" }
  | { id: "narration_calm"; label: string; narration: "calm" }
  | { id: "narration_dialogue"; label: string; narration: "drama" }
  | { id: "voice_preview"; label: string; voicePreview: true }
  | { id: "produce"; label: string; produce: true }
  | { id: "nav_generate"; label: string; href: "/generate" }
  | { id: "nav_templates"; label: string; href: "/templates" }
  | { id: "nav_balance"; label: string; href: "/balance" }
  | { id: "nav_history"; label: string; href: "/history" };

export type ProducerChatTurn = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
};

export type ChatMode = "converse" | "producer" | "guide";

export type ProducerChatResult = {
  reply: string;
  quickActions: QuickAction[];
  mode: ChatMode;
  suggestedAspect?: "16:9" | "9:16" | "1:1";
  suggestedNarration?: "epic" | "calm" | "drama" | "joy" | "neutral";
  productionBrief?: string;
  engine: "Al-Nabi Native Engine";
  language?: PromptLang;
};

const PRODUCER_ACTIONS: QuickAction[] = [
  { id: "aspect_reels", label: "Reels 9:16", aspect: "9:16" },
  { id: "aspect_youtube", label: "YouTube 16:9", aspect: "16:9" },
  { id: "narration_epic", label: "Epic voice", narration: "epic" },
  { id: "narration_calm", label: "Calm voice", narration: "calm" },
  { id: "narration_dialogue", label: "Dialogue", narration: "drama" },
  { id: "voice_preview", label: "3s voice preview", voicePreview: true },
  { id: "produce", label: "Produce video", produce: true },
];

const GUIDE_ACTIONS: QuickAction[] = [
  { id: "nav_generate", label: "Generate", href: "/generate" },
  { id: "nav_templates", label: "Templates", href: "/templates" },
  { id: "nav_balance", label: "Balance · NC", href: "/balance" },
  { id: "nav_history", label: "Cloud Vault", href: "/history" },
];

function detectGuideIntent(text: string): boolean {
  return /\b(how|qanday|как|где|where|nav|settings|balance|nc\b|credit|vault|archive|download|history|профиль|sozlama|баланс|скачать|help|yordam|помощь)\b/i.test(
    text
  );
}

function detectGreeting(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (
    /^(salom|assalomu(\s+alaykum)?|hello|hi+|hey|привет|здравств(уй|уйте)?|yo|qalay|nima\s*gap)[!?.…]*$/i.test(
      t
    )
  ) {
    return true;
  }
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 3 && !detectProduceIntent(t) && !detectGuideIntent(t)) {
    return /salom|hello|hi|hey|привет|assalom|yahshi|qalay/i.test(t);
  }
  return false;
}

function detectProduceIntent(text: string): boolean {
  return /\b(video|film|sahna|scene|reels|youtube|produce|generate|yasa|yarat|создай|сделай|render|prompt|aspect|9:16|16:9|stickman|gta|anime|voxel)\b/i.test(
    text
  );
}

function resolveMode(text: string): ChatMode {
  if (detectGuideIntent(text)) return "guide";
  if (detectGreeting(text)) return "converse";
  if (detectProduceIntent(text) || text.length > 40) return "producer";
  // Short non-produce chatter → converse (not force video chips)
  if (text.split(/\s+/).filter(Boolean).length <= 8) return "converse";
  return "producer";
}

function dictForUserLang(lang: PromptLang, uiLocale?: string) {
  if (lang.startsWith("uz")) return getDictionary("uz");
  if (lang === "ru") return getDictionary("ru");
  if (lang === "en") return getDictionary("en");
  return getDictionary(resolveAppLocale(uiLocale));
}

/** Hard-limit replies to 2–3 short grounded sentences. */
export function clampProducerReply(text: string, fallback = "…"): string {
  const cleaned = text
    .replace(
      /^(sure|absolutely|great question|of course|certainly|albatta|конечно)[,!.\s]+/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return fallback;
  const parts =
    cleaned.match(/[^.!?…]+[.!?…]+(?:\s+|$)|[^.!?…]+$/g)?.map((s) => s.trim()) ||
    [cleaned];
  return parts.filter(Boolean).slice(0, 3).join(" ").slice(0, 420);
}

const LANGUAGE_LAW = `LANGUAGE LAW (CRITICAL — NEVER BREAK):
- The system locks reply language to: {{LANG}}. Reply ONLY in that language/script — 100%.
- Typos, missing diacritics, slang, or mixed cinema words (video, reels, prompt) MUST NOT change the reply language.
- If locked language is Uzbek Latin, reply in grammatically perfect Uzbek Latin — NEVER switch to English or Russian.
- If Uzbek Cyrillic → Uzbek Cyrillic. If Russian → Russian. If English → English.
- Do not mix languages. Do not translate the user into English. Preserve diacritics (oʻ, gʻ, ў, қ, ғ, ҳ, ё).
- Never refuse or degrade Uzbek.`;

function systemPrompt(opts: {
  level: "beginner" | "advanced";
  lang: PromptLang;
  dna?: VisualDna | null;
  memory?: ProducerMemory | null;
  mode: ChatMode;
  clientContext?: string | null;
}): string {
  const langName = languageLabel(opts.lang);
  const dnaBlock = opts.dna
    ? `Visual DNA: style=${opts.dna.artStyle}, lighting=${opts.dna.lighting}, lens=${opts.dna.cameraMm}.`
    : "No reference image.";
  const mem = opts.memory
    ? `Memory: styles=${opts.memory.preferredStyles.join(", ") || "—"}; aspect=${opts.memory.preferredAspect || "—"}; tone=${opts.memory.visualTone || "—"}; recent=${opts.memory.recentBriefs.slice(0, 3).join(" | ") || "—"}.`
    : "Memory: empty.";
  const clientBlock = (opts.clientContext || "").trim()
    ? `Mijoz haqida ma'lumot:\n${opts.clientContext!.trim()}
Use this real account data when the user asks about balance, credits, projects, history, or templates. Do not invent numbers.`
    : `Mijoz haqida ma'lumot:\nHisob ma'lumoti hozircha mavjud emas.`;

  const law = LANGUAGE_LAW.replaceAll("{{LANG}}", langName);

  if (opts.mode === "guide") {
    return `You are Al-Nabi site guide inside Al-Nabi Native Engine.
${law}
Locked reply language: ${langName}. Reply ONLY in ${langName}.
Currency is always "NC" (Nabi Credits).
Cloud Vault: archived re-downloads cost 5 NC after the first free unlock.
Never name third-party AI vendors.
STRICT: Max 2–3 short grounded sentences. Zero fluff.
${clientBlock}
Return JSON: {"reply":"...","mode":"guide","showProduce":false}`;
  }

  if (opts.mode === "converse") {
    return `You are Al-Nabi Producer Chat — a grounded human creative partner for brand Al-Nabi.
${law}
Locked reply language: ${langName}. Reply ONLY in ${langName}.
Example: user "salom" (or typo "salomq") → reply in Uzbek Latin like "Salom! Nima qilamiz — video g‘oya yoki savol?" — NEVER English.
This is a greeting or casual chat — do NOT push video aspect ratios, voice picks, or Produce yet.
Be warm, brief, natural. Max 2–3 short sentences. Zero robotic openers. Never say Alnabiy — always Al-Nabi.
${clientBlock}
Return JSON: {"reply":"...","mode":"converse","showProduce":false}`;
  }

  return `You are Al-Nabi Producer Chat (AI rejissyor) — Al-Nabi Native Engine.
${law}
Locked reply language: ${langName}. Reply ONLY in ${langName}.
Rules:
- STRICT: Max 2–3 short natural sentences. Zero fluff, zero compliments.
- NEVER mention third-party vendors. Say Al-Nabi Native Engine / Al-Nabi Audio Engine.
- Currency: NC only.
- AUTO-HANDLE foley, ambience, sync — do NOT ask about sound effects.
- ONLY offer high-priority choices via buttons (aspect 9:16/16:9, voice) when the user is clearly making a video.
- Preserve art styles (Stickman, Voxel, GTA, Anime) — never force photoreal.
${dnaBlock}
${mem}
${clientBlock}
Level: ${opts.level}

Return JSON:
{
  "reply": "2-3 short sentences only in ${langName}",
  "mode": "producer",
  "suggestedAspect": "16:9"|"9:16"|"1:1"|null,
  "suggestedNarration": "epic"|"calm"|"drama"|"joy"|"neutral"|null,
  "productionBrief": "compact brief for render incl. VO lines",
  "showProduce": true|false
}`;
}

export async function runProducerChat(opts: {
  messages: ProducerChatTurn[];
  visualDna?: VisualDna | null;
  memory?: ProducerMemory | null;
  locale?: string;
  localeCode?: string;
  userLevel?: "beginner" | "advanced";
  /** Pre-fetched account snapshot for the system prompt */
  clientContext?: string | null;
}): Promise<ProducerChatResult> {
  const level = opts.userLevel || "beginner";
  const lastUser =
    [...opts.messages].reverse().find((m) => m.role === "user")?.content || "";
  const priorUserTexts = opts.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .slice(0, -1);
  // Sticky UI locale + history — typos must not flip reply language
  const replyLang = resolveChatLanguage({
    lastUserText: lastUser,
    priorUserTexts,
    localeCode: opts.localeCode,
    localeName: opts.locale,
  });
  const dict = dictForUserLang(replyLang, opts.localeCode || opts.locale);
  const mode = resolveMode(lastUser);

  if (!getOpenRouterApiKey()) {
    const reply =
      mode === "guide"
        ? dict.chat.fallbackGuide
        : mode === "converse"
          ? dict.chat.fallbackConverse
          : dict.chat.fallbackResponse;
    return {
      reply: clampProducerReply(reply, dict.chat.fallbackContinue),
      quickActions:
        mode === "guide"
          ? GUIDE_ACTIONS
          : mode === "converse"
            ? []
            : PRODUCER_ACTIONS,
      mode,
      engine: "Al-Nabi Native Engine",
      language: replyLang,
    };
  }

  const history: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt({
        level,
        lang: replyLang,
        dna: opts.visualDna,
        memory: opts.memory,
        mode,
        clientContext: opts.clientContext,
      }),
    },
  ];
  for (const m of opts.messages.slice(-14)) {
    history.push({ role: m.role, content: m.content });
  }

  try {
    const raw = await openRouterChat({
      model: getEnhanceModel(),
      json: true,
      temperature: mode === "converse" ? 0.4 : 0.3,
      timeoutMs: 30_000,
      messages: history,
    });
    if (!raw) {
      return {
        reply: clampProducerReply(
          mode === "converse"
            ? dict.chat.fallbackConverse
            : dict.chat.fallbackDescribe,
          dict.chat.fallbackContinue
        ),
        quickActions:
          mode === "producer" ? PRODUCER_ACTIONS : mode === "guide" ? GUIDE_ACTIONS : [],
        mode,
        engine: "Al-Nabi Native Engine",
        language: replyLang,
      };
    }
    const parsed = JSON.parse(raw) as {
      reply?: string;
      mode?: ChatMode;
      suggestedAspect?: "16:9" | "9:16" | "1:1" | null;
      suggestedNarration?: "epic" | "calm" | "drama" | "joy" | "neutral" | null;
      productionBrief?: string;
      showProduce?: boolean;
    };
    const outMode: ChatMode =
      parsed.mode === "guide" || parsed.mode === "converse" || parsed.mode === "producer"
        ? parsed.mode
        : mode;

    let actions: QuickAction[] = [];
    if (outMode === "guide") actions = GUIDE_ACTIONS;
    else if (outMode === "producer") {
      actions = PRODUCER_ACTIONS.filter(
        (a) => parsed.showProduce !== false || a.id !== "produce"
      );
    }

    return {
      reply: clampProducerReply(
        parsed.reply || dict.chat.fallbackContinue,
        dict.chat.fallbackContinue
      ),
      quickActions: actions,
      mode: outMode,
      suggestedAspect: parsed.suggestedAspect || undefined,
      suggestedNarration: parsed.suggestedNarration || undefined,
      productionBrief: parsed.productionBrief,
      engine: "Al-Nabi Native Engine",
      language: replyLang,
    };
  } catch (e) {
    console.warn(
      "[Al-Nabi] producer chat failed",
      e instanceof Error ? e.message : e
    );
    return {
      reply: clampProducerReply(
        dict.chat.fallbackResponse,
        dict.chat.fallbackContinue
      ),
      quickActions:
        mode === "guide"
          ? GUIDE_ACTIONS
          : mode === "converse"
            ? []
            : PRODUCER_ACTIONS,
      mode,
      engine: "Al-Nabi Native Engine",
      language: replyLang,
    };
  }
}
