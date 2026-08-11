"use client";

import { Sparkles } from "lucide-react";
import { useProducerChat } from "@/context/ProducerChatContext";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Header CTA — neon glow opens floating Producer Chat.
 */
export function ProducerChatTrigger() {
  const { open, toggleChat } = useProducerChat();
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleChat}
      aria-expanded={open}
      aria-controls="producer-chat-float"
      aria-label="Producer Chat"
      className="producer-chat-trigger group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full px-3 py-1.5 text-xs font-semibold text-white sm:text-sm"
    >
      <span className="producer-chat-trigger__glow" aria-hidden />
      <Sparkles size={14} className="relative z-10 text-white" />
      <span className="relative z-10 hidden whitespace-nowrap sm:inline">
        <span aria-hidden>✨ </span>
        Producer Chat
      </span>
    </button>
  );
}
