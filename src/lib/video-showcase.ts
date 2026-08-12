/**
 * Curated video generation showcase examples for /generate.
 *
 * Fill `beforeImage` (source still) and `afterVideo` (result clip) per entry.
 * Empty URLs render a styled placeholder until assets are provided.
 */
export type VideoShowcaseExample = {
  id: string;
  /** Source / "before" still */
  beforeImage?: string;
  /** Generated "after" video (muted loop) */
  afterVideo?: string;
  /** Optional poster while video loads */
  afterPoster?: string;
  prompt: string;
  title: string;
  description: string;
};

export const VIDEO_SHOWCASE_EXAMPLES: VideoShowcaseExample[] = [
  {
    id: "composition",
    prompt: "Extreme close-up of an eye with city reflected in it",
    title: "Composition",
    description: "Create immersive videos from text descriptions",
  },
  {
    id: "cinematic",
    prompt: "A lone traveler walks through neon rain on a silent street",
    title: "Cinematic",
    description: "Mood, light, and camera motion in one prompt",
  },
  {
    id: "portrait",
    prompt: "Slow push-in on a portrait lit by golden hour sunbeams",
    title: "Portrait",
    description: "Lifelike faces and gentle camera moves",
  },
  {
    id: "nature",
    prompt: "Aerial glide over misty mountains at dawn",
    title: "Nature",
    description: "Wide landscapes with smooth cinematic motion",
  },
  {
    id: "product",
    prompt: "Orbiting product shot of a perfume bottle on black glass",
    title: "Product",
    description: "Studio-grade loops for ads and launches",
  },
  {
    id: "fantasy",
    prompt: "A glowing crystal floating above ancient ruins at night",
    title: "Fantasy",
    description: "Dreamlike worlds from a short text idea",
  },
];

export const VIDEO_SHOWCASE_AUTOPLAY_MS = 6500;
