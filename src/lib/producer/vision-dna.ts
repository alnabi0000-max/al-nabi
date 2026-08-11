/**
 * Multi-modal Vision DNA — Al-Nabi Native Engine (OpenRouter vision, white-label).
 */

import {
  getOpenRouterApiKey,
  getVisionModel,
  openRouterChat,
} from "@/lib/ai/openrouter";

export type VisualDna = {
  lighting: string;
  cameraMm: string;
  aspectHint: "16:9" | "9:16" | "1:1" | "unknown";
  frameRateHint: 24 | 30 | 60 | null;
  artStyle: string;
  mood: string;
  palette: string[];
  subjectSummary: string;
  /** Soft plain-language summary for chat (no jargon dump) */
  plainSummary: string;
  /** Prompt fragment to inject into video generation */
  promptDna: string;
};

function fallbackDna(note?: string): VisualDna {
  return {
    lighting: "natural soft key",
    cameraMm: "35mm",
    aspectHint: "16:9",
    frameRateHint: 24,
    artStyle: "cinematic",
    mood: "neutral",
    palette: ["#1a1a1a", "#c4c4c4"],
    subjectSummary: note || "uploaded reference",
    plainSummary:
      "Reference captured. We'll match its look — lighting, framing, and style — in your video.",
    promptDna:
      "match reference lighting and framing, coherent art style, cinematic motion",
  };
}

/**
 * Analyze image/screenshot (data URL or https) into Visual DNA.
 */
export async function analyzeVisualDna(opts: {
  imageUrl: string;
  locale?: string;
  userLevel?: "beginner" | "advanced";
}): Promise<VisualDna> {
  const imageUrl = opts.imageUrl.trim();
  if (!imageUrl) return fallbackDna();

  if (!getOpenRouterApiKey()) {
    return fallbackDna("offline reference");
  }

  const level = opts.userLevel || "beginner";
  const locale = opts.locale || "English";

  try {
    const raw = await openRouterChat({
      model: getVisionModel(),
      json: true,
      temperature: 0.3,
      timeoutMs: 35_000,
      messages: [
        {
          role: "system",
          content: `You are Al-Nabi Native Engine vision analyst.
Extract Visual DNA from the image. Never name third-party AI vendors.
Return JSON only:
{
  "lighting": "short",
  "cameraMm": "e.g. 24mm|35mm|50mm|85mm",
  "aspectHint": "16:9|9:16|1:1|unknown",
  "frameRateHint": 24|30|60|null,
  "artStyle": "e.g. Photorealistic|Anime|Stickman|GTA|Voxel|Illustration",
  "mood": "short",
  "palette": ["#hex","#hex"],
  "subjectSummary": "one line",
  "plainSummary": "${level === "beginner" ? "simple friendly 1-2 sentences" : "precise but concise technical summary"} in ${locale}",
  "promptDna": "compact video prompt fragment preserving art style, lighting, lens feel"
}
If art style is non-photoreal (Stickman, GTA, Anime, Voxel), NEVER suggest photoreal skin.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this reference for Al-Nabi Producer Chat Visual DNA.",
            },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "low" },
            },
          ],
        },
      ],
    });

    if (!raw) return fallbackDna();
    const parsed = JSON.parse(raw) as Partial<VisualDna>;
    const aspect =
      parsed.aspectHint === "9:16" ||
      parsed.aspectHint === "1:1" ||
      parsed.aspectHint === "16:9"
        ? parsed.aspectHint
        : "unknown";

    return {
      lighting: parsed.lighting || "soft key",
      cameraMm: parsed.cameraMm || "35mm",
      aspectHint: aspect,
      frameRateHint:
        parsed.frameRateHint === 24 ||
        parsed.frameRateHint === 30 ||
        parsed.frameRateHint === 60
          ? parsed.frameRateHint
          : 24,
      artStyle: parsed.artStyle || "cinematic",
      mood: parsed.mood || "neutral",
      palette: Array.isArray(parsed.palette) ? parsed.palette.slice(0, 5) : [],
      subjectSummary: parsed.subjectSummary || "reference subject",
      plainSummary:
        parsed.plainSummary ||
        "Reference look noted — we'll carry its style into the render.",
      promptDna:
        parsed.promptDna ||
        `${parsed.artStyle || "cinematic"} style, ${parsed.lighting || "matched lighting"}`,
    };
  } catch (e) {
    console.warn(
      "[Al-Nabi] vision DNA failed",
      e instanceof Error ? e.message : e
    );
    return fallbackDna();
  }
}
