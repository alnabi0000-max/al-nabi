"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useProducerChat } from "@/context/ProducerChatContext";

function ChatQueryOpenerInner() {
  const searchParams = useSearchParams();
  const { openChat } = useProducerChat();

  useEffect(() => {
    if (searchParams.get("chat") === "1") openChat();
  }, [searchParams, openChat]);

  return null;
}

/** Opens floating Producer Chat when `?chat=1`. */
export function ChatQueryOpener() {
  return (
    <Suspense fallback={null}>
      <ChatQueryOpenerInner />
    </Suspense>
  );
}
