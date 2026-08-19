/**
 * Curated video generation showcase examples.
 *
 * `afterVideo` clips are royalty-free Pexels stock used as a live demo of
 * cinematic motion until first-party Al-Nabi renders are uploaded here.
 */
export type VideoShowcaseExample = {
  id: string;
  beforeImage?: string;
  afterVideo?: string;
  afterPoster?: string;
  prompt: string;
  title: string;
  description: string;
};

const pexels = (id: string, file: string) =>
  `https://videos.pexels.com/video-files/${id}/${file}.mp4`;

export const VIDEO_SHOWCASE_EXAMPLES: VideoShowcaseExample[] = [
  {
    id: "composition",
    afterVideo: pexels("3195394", "3195394-hd_1280_720_25fps"),
    prompt: "Extreme close-up of an eye with city reflected in it",
    title: "Composition",
    description: "Create immersive videos from text descriptions",
  },
  {
    id: "cinematic",
    afterVideo: pexels("1409899", "1409899-hd_1280_720_25fps"),
    prompt: "A lone traveler walks through neon rain on a silent street",
    title: "Cinematic",
    description: "Mood, light, and camera motion in one prompt",
  },
  {
    id: "portrait",
    afterVideo: pexels("3130182", "3130182-hd_1280_720_30fps"),
    prompt: "Slow push-in on a portrait lit by golden hour sunbeams",
    title: "Portrait",
    description: "Lifelike faces and gentle camera moves",
  },
  {
    id: "nature",
    afterVideo: pexels("3571264", "3571264-hd_1280_720_30fps"),
    prompt: "Aerial glide over misty mountains at dawn",
    title: "Nature",
    description: "Wide landscapes with smooth cinematic motion",
  },
  {
    id: "product",
    afterVideo: pexels("5752729", "5752729-hd_1280_720_30fps"),
    prompt: "Orbiting product shot of a perfume bottle on black glass",
    title: "Product",
    description: "Studio-grade loops for ads and launches",
  },
  {
    id: "fantasy",
    afterVideo: pexels("5377684", "5377684-hd_1280_720_25fps"),
    prompt: "A glowing crystal floating above ancient ruins at night",
    title: "Fantasy",
    description: "Dreamlike worlds from a short text idea",
  },
];

export const VIDEO_SHOWCASE_AUTOPLAY_MS = 7000;
