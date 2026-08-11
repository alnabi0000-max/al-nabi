/**
 * ElevenLabs Voice Engine — Script-to-Movie dubbing / TTS
 * Key: ELEVENLABS_API_KEY
 *
 * Asosiy implementatsiya: src/lib/audio.ts (synthesizeSpeech, cloneVoice)
 * Bu modul — aniq export yuzasi + sozlanganlik tekshiruvi.
 */

export {
  synthesizeSpeech,
  synthesizeSpeechBuffer,
  cloneVoice,
  emotionToVoiceSettings,
  type AudioSynthResult,
  type ElevenModel,
  type VoiceSettings,
  type WordTiming,
} from "@/lib/audio";

export function getElevenLabsApiKey(): string | null {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key || key.includes("...")) return null;
  return key;
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(getElevenLabsApiKey());
}

export function getElevenLabsDefaults() {
  return {
    voiceId:
      process.env.ELEVENLABS_VOICE_ID?.trim() || "21m00Tcm4TlvDq8ikWAM",
    model:
      process.env.ELEVENLABS_MODEL?.trim() || "eleven_multilingual_v2",
  };
}
