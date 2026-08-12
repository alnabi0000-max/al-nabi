/**
 * Verify silent model history window.
 * Run: npx tsx scripts/verify-chat-window.ts
 */
import {
  PRODUCER_MODEL_HISTORY_WINDOW,
  selectMessagesForModel,
  type ProducerChatTurn,
} from "../src/lib/producer/chat";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const many: ProducerChatTurn[] = [
  { role: "assistant", content: "Xush kelibsiz" },
];
for (let i = 0; i < 20; i++) {
  many.push({ role: "user", content: `u${i}` });
  many.push({ role: "assistant", content: `a${i}` });
}

const selected = selectMessagesForModel(many);
assert(
  selected.length === PRODUCER_MODEL_HISTORY_WINDOW,
  `window === ${PRODUCER_MODEL_HISTORY_WINDOW}`
);
assert(
  selected[selected.length - 1]?.content === "a19",
  "keeps newest assistant"
);
assert(
  !selected.some((m) => m.content === "Xush kelibsiz"),
  "old welcome falls outside window"
);

const short = selectMessagesForModel([
  { role: "user", content: "salom" },
  { role: "assistant", content: "Salom!" },
]);
assert(short.length === 2, "short threads untouched");

console.log("OK — chat model window", {
  window: PRODUCER_MODEL_HISTORY_WINDOW,
  selected: selected.length,
});
