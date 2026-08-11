/**
 * Orqa moslik — yangi engine: `@/lib/audio`
 */
import { synthesizeSpeech } from "@/lib/audio";
import type { EmotionMode } from "@/lib/credits";

export async function synthesizeVoice(
  text: string,
  outPath: string,
  emotion: EmotionMode = "neutral"
): Promise<string> {
  const result = await synthesizeSpeech({
    text,
    outPath,
    emotion,
  });
  return result.audioPath;
}

export {
  synthesizeSpeech,
  prepareSpeechText,
  cloneVoice,
  emotionToVoiceSettings,
} from "@/lib/audio";
