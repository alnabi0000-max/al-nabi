import fs from "fs";
import path from "path";

const dir = path.join(process.cwd(), "src", "locales");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

/** Common UTF-8→cp1252→UTF-8 mojibake leftovers */
const pairs = [
  ["вЂ”", "—"],
  ["вЂ“", "–"],
  ["вЂ™", "’"],
  ["вЂ˜", "‘"],
  ["вЂњ", "“"],
  ["вЂќ", "”"],
  ["вЂ¦", "…"],
  ["вЂў", "•"],
  ["вЂ", ""], // stray leftover
  ["В·", "·"],
  ["В ", " "],
  ["РїРѕ", "по"], // sample russian double-encode start — skip broad
];

let touched = 0;
for (const f of files) {
  const p = path.join(dir, f);
  let s = fs.readFileSync(p, "utf8");
  const orig = s;
  for (const [from, to] of pairs) {
    if (from) s = s.split(from).join(to);
  }
  if (s !== orig) {
    fs.writeFileSync(p, s);
    touched += 1;
    console.log("fixed", f);
  }
}
console.log("files_touched", touched);
