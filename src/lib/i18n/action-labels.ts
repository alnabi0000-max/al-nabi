import type { QuickAction } from "@/lib/producer/chat";
import type { Dictionary } from "@/i18n/dictionary";

/** Map Producer Chat quick-action ids → live dictionary labels */
export function labelForQuickAction(
  action: QuickAction,
  t: Dictionary
): string {
  switch (action.id) {
    case "aspect_reels":
      return t.chat.reels;
    case "aspect_youtube":
      return t.chat.youtube;
    case "narration_epic":
      return t.chat.epicVoice;
    case "narration_calm":
      return t.chat.calmVoice;
    case "narration_dialogue":
      return t.chat.dialogue;
    case "voice_preview":
      return t.chat.voicePreview;
    case "produce":
      return t.chat.produce;
    case "nav_generate":
      return t.chat.navGenerate;
    case "nav_templates":
      return t.chat.navTemplates;
    case "nav_balance":
      return t.chat.navBalance;
    case "nav_history":
      return t.chat.navHistory;
    case "select_template":
      return action.label || action.templateTitle;
    case "tool_navigate":
      return action.label || action.href;
    default: {
      const fallback = action as QuickAction & { label?: string };
      return fallback.label || fallback.id;
    }
  }
}
