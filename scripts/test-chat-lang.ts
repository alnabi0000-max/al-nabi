import {
  detectPromptLanguage,
  resolveChatLanguage,
} from "../src/lib/ai/prompt-language";

const cases: Array<[string, string, string]> = [
  ["salom", "uz", "uz-Latn"],
  ["salomq nima gap", "uz", "uz-Latn"],
  ["men video yasamoqchiman", "uz", "uz-Latn"],
  ["mn vdeo yratmoqchimn", "uz", "uz-Latn"],
  ["Hello make a video please", "uz", "en"],
  ["привет сделай видео", "ru", "ru"],
  ["qanday video yasaymiz", "uz", "uz-Latn"],
];

let failed = 0;
for (const [text, loc, expect] of cases) {
  const chat = resolveChatLanguage({
    lastUserText: text,
    localeCode: loc,
    priorUserTexts: ["salom aka"],
  });
  const detect = detectPromptLanguage(text);
  const ok = chat === expect;
  if (!ok) failed++;
  console.log(
    `${ok ? "OK" : "FAIL"} text=${JSON.stringify(text)} detect=${detect} chat=${chat} expect=${expect}`
  );
}
process.exit(failed ? 1 : 0);
