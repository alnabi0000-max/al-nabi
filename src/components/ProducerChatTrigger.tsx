"use client";

import { MessageSquare } from "lucide-react";
import { useProducerChat } from "@/context/ProducerChatContext";
import { useLanguage } from "@/context/LanguageContext";

/** Header copilot — opens floating Producer Chat. */
export function ProducerChatTrigger() {
  const { open, toggleChat } = useProducerChat();
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleChat}
      aria-expanded={open}
      aria-controls="producer-chat-float"
      aria-label={t.header.producerChat}
      className="producer-chat-trigger inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium sm:text-sm"
    >
      <MessageSquare size={14} />
      <span className="hidden sm:inline">{t.header.producerChat}</span>
    </button>
  );
}
