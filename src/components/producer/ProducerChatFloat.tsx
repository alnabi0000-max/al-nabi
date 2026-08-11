"use client";

import { memo, useRef } from "react";
import { useProducerChat } from "@/context/ProducerChatContext";
import { ProducerChat } from "@/components/producer/ProducerChat";
import { useLanguage } from "@/context/LanguageContext";
import { useDialogFocus } from "@/hooks/useDialogFocus";

/**
 * Floating Producer Chat dock — opened from header neon CTA.
 * Memoized so parent locale/balance ticks don't rebuild the panel tree.
 */
export const ProducerChatFloat = memo(function ProducerChatFloat() {
  const { open, closeChat } = useProducerChat();
  const { t } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);

  useDialogFocus(panelRef, open, closeChat);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <button
        type="button"
        aria-label={t.chat.close}
        className="absolute inset-0 bg-black/60"
        onClick={closeChat}
      />
      <div
        id="producer-chat-float"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.header.producerChat}
        tabIndex={-1}
        className="producer-chat-float relative z-10 flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col overflow-hidden border-l border-white/10 bg-[#0B0C12] shadow-[-24px_0_80px_rgba(0,0,0,0.55)] outline-none sm:max-w-[420px]"
      >
        <ProducerChat compact onClose={closeChat} />
      </div>
    </div>
  );
});
