/**
 * Reverses systemic UTF-8 → Windows-1251 → UTF-8 double-encoding mojibake
 * across all src/locales/*.json files.
 *
 * Root cause: at some point every locale file's original UTF-8 bytes were
 * decoded as Windows-1251 (Cyrillic) and the resulting (garbled) string was
 * then re-saved as UTF-8. This affects ALL languages equally (fr, de, ru,
 * zh, ar, ja, ...) because the corruption happens at the raw byte level,
 * not the linguistic level.
 *
 * Fix: for every maximal run of 2+ consecutive "CP1251-plausible" characters,
 * re-encode those characters back to their original CP1251 byte values, then
 * decode that byte sequence as UTF-8. If the result round-trips cleanly
 * (no replacement characters), use it — otherwise leave the original text
 * untouched (safety fallback for anything that isn't actually mojibake).
 *
 * Isolated single "suspect" characters (e.g. a genuine standalone em dash
 * or ellipsis) are left alone, since real mojibake always appears in runs
 * of 2+ characters (one multi-byte UTF-8 character always decodes to 2-4
 * CP1251 characters).
 */
import fs from "fs";
import path from "path";

const LOCALES_DIR = path.join(process.cwd(), "src", "locales");

/** Build char -> byte map for the upper half (0x80-0xFF) of Windows-1251. */
function buildCp1251ReverseMap() {
  const map = new Map();
  for (let byte = 0x80; byte <= 0xff; byte++) {
    const decoded = new TextDecoder("windows-1251", { fatal: false }).decode(
      Uint8Array.of(byte)
    );
    if (decoded && decoded !== "\ufffd") {
      map.set(decoded, byte);
    }
  }
  return map;
}

const CP1251_REVERSE = buildCp1251ReverseMap();

function isSuspect(ch) {
  return CP1251_REVERSE.has(ch);
}

function tryDecodeRun(run) {
  const bytes = [];
  for (const ch of run) {
    const b = CP1251_REVERSE.get(ch);
    if (b === undefined) return null;
    bytes.push(b);
  }
  const buf = Uint8Array.from(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return null;
  }
}

function fixMojibake(text) {
  let out = "";
  let i = 0;
  let stats = { runsFixed: 0, runsSkipped: 0 };
  while (i < text.length) {
    const ch = text[i];
    if (!isSuspect(ch)) {
      out += ch;
      i++;
      continue;
    }
    let j = i;
    while (j < text.length && isSuspect(text[j])) j++;
    const run = text.slice(i, j);
    if (run.length >= 2) {
      const decoded = tryDecodeRun(run);
      if (decoded !== null) {
        out += decoded;
        stats.runsFixed++;
      } else {
        out += run;
        stats.runsSkipped++;
        if (process.argv.includes("--report-skipped")) {
          const ctxStart = Math.max(0, i - 20);
          const ctxEnd = Math.min(text.length, j + 20);
          console.log(
            `  SKIPPED run: "${run}" ...context: ...${text.slice(ctxStart, ctxEnd)}...`
          );
        }
      }
    } else {
      out += run; // isolated suspect char — likely genuine, leave as-is
    }
    i = j;
  }
  return { text: out, stats };
}

const files = fs
  .readdirSync(LOCALES_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();

const dryRun = process.argv.includes("--dry-run");
const only = process.argv.find((a) => a.startsWith("--only="));
const onlyFiles = only ? only.slice("--only=".length).split(",") : null;

for (const file of files) {
  if (onlyFiles && !onlyFiles.includes(file)) continue;
  const full = path.join(LOCALES_DIR, file);
  const raw = fs.readFileSync(full, "utf8");
  const { text: fixed, stats } = fixMojibake(raw);

  // Validate JSON structure is preserved (strip BOM only for the check)
  try {
    JSON.parse(fixed.replace(/^\uFEFF/, ""));
  } catch (e) {
    console.error(`SKIP ${file}: fixed output is not valid JSON (${e.message})`);
    continue;
  }

  if (fixed === raw) {
    console.log(`${file}: no changes (runsFixed=0)`);
    continue;
  }

  console.log(
    `${file}: runsFixed=${stats.runsFixed} runsSkipped=${stats.runsSkipped}`
  );
  if (!dryRun) {
    fs.writeFileSync(full, fixed, "utf8");
  }
}

console.log(dryRun ? "\nDry run complete — no files written." : "\nDone.");
