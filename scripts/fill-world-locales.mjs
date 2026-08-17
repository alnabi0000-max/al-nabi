/**
 * Merge canonical English keys + world translations into src/locales/*.json
 * so every picker language has a complete UI pack.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STRINGS } from "./i18n-world-strings.mjs";
import { PACK, WORLD_LANGS } from "./i18n-world-pack.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "src", "locales");
const ALL = [
  "uz",
  "en",
  "ru",
  "fr",
  "ar",
  "es",
  "de",
  "tr",
  "zh",
  "ja",
  "ko",
  "hi",
  "pt",
  "it",
  "id",
  "ms",
  "fa",
  "uk",
  "pl",
  "nl",
];

function readJson(code) {
  return JSON.parse(fs.readFileSync(path.join(outDir, `${code}.json`), "utf8"));
}

function writeJson(code, data) {
  fs.writeFileSync(
    path.join(outDir, `${code}.json`),
    JSON.stringify(data, null, 2) + "\n",
    "utf8"
  );
}

const badPack = Object.entries(PACK).filter(
  ([, values]) => !Array.isArray(values) || values.length !== WORLD_LANGS.length
);
if (badPack.length) {
  throw new Error(
    `PACK arrays must have ${WORLD_LANGS.length} values: ${badPack
      .slice(0, 8)
      .map(([k, v]) => `${k}(${Array.isArray(v) ? v.length : typeof v})`)
      .join(", ")}`
  );
}

const packIndex = Object.fromEntries(WORLD_LANGS.map((code, i) => [code, i]));

for (const code of ["en", "uz", "ru"]) {
  const next = { ...readJson(code) };
  for (const [key, row] of Object.entries(STRINGS)) {
    const translated = row?.[code];
    if (typeof translated === "string" && translated.trim()) {
      next[key] = translated;
    }
  }
  writeJson(code, next);
}

const en = readJson("en");
let packHits = 0;

for (const code of WORLD_LANGS) {
  const prev = readJson(code);
  const next = {};
  for (const key of Object.keys(en)) {
    next[key] = prev[key] ?? en[key];
  }
  const idx = packIndex[code];
  for (const [key, values] of Object.entries(PACK)) {
    const translated = values[idx];
    if (typeof translated === "string" && translated.trim()) {
      next[key] = translated;
      packHits += 1;
    }
  }
  writeJson(code, next);
}

const sample = readJson("fr");
const missing = Object.keys(en).filter((k) => !(k in sample));
const stillEnglish = Object.keys(PACK).filter((k) => sample[k] === en[k]).length;
console.log(
  `Filled ${ALL.length} locale files. packHits=${packHits} frKeys=${Object.keys(sample).length} missingVsEn=${missing.length} packStillEn=${stillEnglish}`
);
