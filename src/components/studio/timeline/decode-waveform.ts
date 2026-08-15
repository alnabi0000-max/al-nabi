"use client";

import { seedWaveform, WAVEFORM_BARS } from "@/lib/studio/timeline";

/** Decode an audio URL into 0..1 peaks. Falls back to a seeded waveform. */
export async function decodeWaveformPeaks(
  url: string,
  bars = WAVEFORM_BARS
): Promise<number[]> {
  if (typeof window === "undefined" || !url) return seedWaveform(url, bars);
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return seedWaveform(url, bars);
    const ctx = new Ctx();
    const audio = await ctx.decodeAudioData(buf.slice(0));
    const channel = audio.getChannelData(0);
    const size = Math.max(1, Math.floor(channel.length / bars));
    const peaks: number[] = [];
    for (let i = 0; i < bars; i++) {
      let sum = 0;
      const start = i * size;
      const end = Math.min(channel.length, start + size);
      for (let j = start; j < end; j++) sum += Math.abs(channel[j] || 0);
      peaks.push(Math.min(1, (sum / Math.max(1, end - start)) * 3.2));
    }
    void ctx.close();
    return peaks;
  } catch {
    return seedWaveform(url, bars);
  }
}
