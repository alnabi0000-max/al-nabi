"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useProducerChat } from "@/context/ProducerChatContext";
import { useMaster } from "@/context/MasterControllerContext";

const CyberShield = dynamic(
  () =>
    import("@/components/CyberShield").then((m) => ({ default: m.CyberShield })),
  { ssr: false }
);

const ProducerChatFloat = dynamic(
  () =>
    import("@/components/producer/ProducerChatFloat").then((m) => ({
      default: m.ProducerChatFloat,
    })),
  { ssr: false }
);

const InsufficientFundsModal = dynamic(
  () =>
    import("@/components/InsufficientFundsModal").then((m) => ({
      default: m.InsufficientFundsModal,
    })),
  { ssr: false }
);

/**
 * Mount heavy chrome only when needed — avoids parsing ProducerChat on every page load.
 */
export function ClientHeavyChrome() {
  const { open } = useProducerChat();
  const { showHalolModal, isBanned, showInsufficientModal } = useMaster();
  const [chatMounted, setChatMounted] = useState(false);
  const [shieldMounted, setShieldMounted] = useState(false);

  useEffect(() => {
    if (open) setChatMounted(true);
  }, [open]);

  useEffect(() => {
    if (showHalolModal || isBanned) setShieldMounted(true);
  }, [showHalolModal, isBanned]);

  return (
    <>
      {shieldMounted ? <CyberShield /> : null}
      {showInsufficientModal ? <InsufficientFundsModal /> : null}
      {chatMounted ? <ProducerChatFloat /> : null}
    </>
  );
}
