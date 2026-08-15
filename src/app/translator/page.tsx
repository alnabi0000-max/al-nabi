import type { Metadata } from "next";
import { VoiceTranslatorStudio } from "@/components/translator/VoiceTranslatorStudio";

export const metadata: Metadata = {
  title: "Voice Translator",
  description:
    "Video-to-video voice cloning and lip-sync translation workspace",
};

export default function TranslatorPage() {
  return <VoiceTranslatorStudio />;
}
