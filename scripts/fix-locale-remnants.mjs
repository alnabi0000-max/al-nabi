/**
 * One-off patch for the handful of locale strings that mixed genuine
 * already-correct characters with leftover mojibake in the SAME run,
 * which fix-locale-mojibake-v2.mjs safely declined to touch (see its
 * --report-skipped output). Values here are corrected by hand.
 */
import fs from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "src", "locales");

function patch(file, edits) {
  const full = path.join(DIR, file);
  const raw = fs.readFileSync(full, "utf8");
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const obj = JSON.parse(hasBom ? raw.slice(1) : raw);
  let changed = 0;
  for (const [key, value] of Object.entries(edits)) {
    if (!(key in obj)) {
      console.warn(`  ${file}: key "${key}" not found — skipping`);
      continue;
    }
    obj[key] = value;
    changed++;
  }
  const out = JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(full, (hasBom ? "\ufeff" : "") + out, "utf8");
  console.log(`${file}: patched ${changed} key(s)`);
}

patch("ru.json", {
  render_in_progress: "Рендер…",
});

patch("uk.json", {
  auto_enhance: "Авто-покращення",
  viral_title: "Вірусний прев'ю та хуки",
});

patch("fa.json", {
  dashboard_total_spent: "مجموع سکه‌های مصرف‌شده",
  preview: "پیش‌نمایش",
  home_tagline:
    "Script-to-Movie، Al-Nabi Realism Engine و سکه‌های Al-Nabi — همه در یک استودیو.",
  viral_title: "پیش‌نمایش ویروسی و هوک",
});

console.log("Done.");
