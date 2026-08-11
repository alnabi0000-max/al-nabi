import fs from "fs";
import path from "path";

const dir = path.join(process.cwd(), "src", "locales");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
let changed = 0;

const replacements = [
  [/Alnabiy/g, "Al-Nabi"],
  [/Al-Nabi\.app/g, "alnabiy.app"],
  [/вЂ"/g, "—"],
  [/вЂ'/g, "’"],
  [/вЂ˜/g, "‘"],
  [/вЂœ/g, "“"],
  [/вЂќ/g, "”"],
  [/В·/g, "·"],
  [/в‰¤/g, "≤"],
  [/в‰Ґ/g, "≥"],
  [/вЂ¦/g, "…"],
];

for (const f of files) {
  const p = path.join(dir, f);
  let s = fs.readFileSync(p, "utf8");
  const orig = s;
  for (const [re, to] of replacements) s = s.replace(re, to);
  if (s !== orig) {
    fs.writeFileSync(p, s);
    changed += 1;
    console.log("fixed", f);
  }
}

console.log("files_touched", changed);
