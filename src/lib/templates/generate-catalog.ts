import type {
  AlnabiInternalModel,
  StudioTemplate,
  TemplateAspect,
  TemplateCategory,
} from "@/lib/templates/types";

import { PREVIEW_POOL, previewFallbackForId } from "@/lib/templates/preview-pool";

export { previewFallbackForId };

type Seed = {
  adjective: string;
  motif: string;
  styleTail: string;
  subjectHint: string;
  aspect: TemplateAspect;
  motion: number;
  model: AlnabiInternalModel;
};

const SEEDS: Record<TemplateCategory, Seed[]> = {
  Cinematic: [
    {
      adjective: "Cyberpunk",
      motif: "Neon Motion",
      styleTail:
        "cinematic shot, neon lights, 8k resolution, photorealistic, highly detailed",
      subjectHint: "a lone figure in the rain",
      aspect: "16:9",
      motion: 5,
      model: "alnabi-cinematic-ultra",
    },
    {
      adjective: "Desert",
      motif: "Epic Sweep",
      styleTail:
        "vast golden dunes, epic wide shot, dust particles, cinematic color grade",
      subjectHint: "a rider on horseback",
      aspect: "16:9",
      motion: 3,
      model: "alnabi-cinematic",
    },
    {
      adjective: "Noir",
      motif: "Rain Alley",
      styleTail:
        "moody film noir, wet asphalt reflections, volumetric fog, anamorphic bokeh",
      subjectHint: "a detective under a streetlamp",
      aspect: "16:9",
      motion: 2,
      model: "alnabi-cinematic",
    },
    {
      adjective: "Golden",
      motif: "Hour Portrait",
      styleTail:
        "golden hour backlight, shallow depth of field, soft lens flare, photoreal skin",
      subjectHint: "a couple walking",
      aspect: "9:16",
      motion: 2,
      model: "alnabi-motion-pro",
    },
    {
      adjective: "Arctic",
      motif: "Aurora Drift",
      styleTail:
        "arctic landscape, northern lights, slow cinematic push-in, crisp 8k detail",
      subjectHint: "a cabin on ice",
      aspect: "16:9",
      motion: 4,
      model: "alnabi-cinematic-ultra",
    },
    {
      adjective: "Ocean",
      motif: "Storm Break",
      styleTail:
        "towering waves, dramatic storm light, high dynamic range, IMAX energy",
      subjectHint: "a ship cresting a wave",
      aspect: "16:9",
      motion: 5,
      model: "alnabi-cinematic-ultra",
    },
    {
      adjective: "Urban",
      motif: "Dawn Skyline",
      styleTail:
        "city skyline at dawn, aerial glide, soft haze, premium real-estate grade",
      subjectHint: "glass towers",
      aspect: "16:9",
      motion: 3,
      model: "alnabi-cinematic",
    },
    {
      adjective: "Vintage",
      motif: "Film Grain",
      styleTail:
        "35mm film look, subtle grain, warm halation, classic cinema framing",
      subjectHint: "a classic convertible",
      aspect: "16:9",
      motion: 2,
      model: "alnabi-cinematic",
    },
  ],
  Anime: [
    {
      adjective: "Sakura",
      motif: "Wind Sweep",
      styleTail:
        "anime key visual, cherry blossoms, dynamic hair motion, cel-shaded lighting",
      subjectHint: "a student on a rooftop",
      aspect: "16:9",
      motion: 4,
      model: "alnabi-motion-pro",
    },
    {
      adjective: "Mecha",
      motif: "Launch Bay",
      styleTail:
        "anime mecha aesthetic, glowing thrusters, dramatic low angle, crisp linework",
      subjectHint: "a giant robot",
      aspect: "16:9",
      motion: 5,
      model: "alnabi-cinematic-ultra",
    },
    {
      adjective: "Studio",
      motif: "Slice of Life",
      styleTail:
        "soft anime lighting, warm interiors, gentle camera drift, storybook clarity",
      subjectHint: "friends sharing tea",
      aspect: "16:9",
      motion: 1,
      model: "alnabi-cinematic",
    },
    {
      adjective: "Shonen",
      motif: "Power Aura",
      styleTail:
        "shonen battle energy, speed lines, intense rim light, high-impact motion",
      subjectHint: "a fighter charging forward",
      aspect: "9:16",
      motion: 5,
      model: "alnabi-motion-pro",
    },
    {
      adjective: "Dreamscape",
      motif: "Floating Isles",
      styleTail:
        "fantasy anime skies, floating islands, painterly clouds, magical atmosphere",
      subjectHint: "a traveler with a staff",
      aspect: "16:9",
      motion: 3,
      model: "alnabi-cinematic",
    },
    {
      adjective: "Neon",
      motif: "Night District",
      styleTail:
        "anime city night, neon signs, rain reflections, stylish character pose",
      subjectHint: "a courier on a hoverbike",
      aspect: "9:16",
      motion: 4,
      model: "alnabi-motion-pro",
    },
    {
      adjective: "Ink",
      motif: "Brush Motion",
      styleTail:
        "sumi-e inspired anime, ink wash transitions, elegant silhouette motion",
      subjectHint: "a samurai in mist",
      aspect: "1:1",
      motion: 2,
      model: "alnabi-auto",
    },
    {
      adjective: "Magical",
      motif: "Girl Transform",
      styleTail:
        "magical girl sparkle trails, costume reveal energy, vibrant pastel palette",
      subjectHint: "a heroine mid-transformation",
      aspect: "9:16",
      motion: 5,
      model: "alnabi-cinematic-ultra",
    },
  ],
  VFX: [
    {
      adjective: "Particle",
      motif: "Storm Burst",
      styleTail:
        "dense particle simulation, volumetric light shafts, high-end VFX composite",
      subjectHint: "an energy orb",
      aspect: "16:9",
      motion: 5,
      model: "alnabi-cinematic-ultra",
    },
    {
      adjective: "Portal",
      motif: "Rift Open",
      styleTail:
        "dimensional portal, refractive distortion, holographic debris, sci-fi VFX",
      subjectHint: "a glowing doorway",
      aspect: "16:9",
      motion: 4,
      model: "alnabi-motion-pro",
    },
    {
      adjective: "Liquid",
      motif: "Mercury Flow",
      styleTail:
        "chrome liquid metal, slow-motion splash, studio HDRI reflections",
      subjectHint: "a morphing logo mark",
      aspect: "1:1",
      motion: 3,
      model: "alnabi-cinematic",
    },
    {
      adjective: "Explosion",
      motif: "Macro Debris",
      styleTail:
        "macro explosion debris, pyro simulation look, cinematic slow motion",
      subjectHint: "a crumbling statue",
      aspect: "16:9",
      motion: 5,
      model: "alnabi-cinematic-ultra",
    },
    {
      adjective: "Hologram",
      motif: "Data Ghost",
      styleTail:
        "holographic UI particles, scanlines, glitch accents, futuristic HUD",
      subjectHint: "a floating interface",
      aspect: "9:16",
      motion: 3,
      model: "alnabi-motion-pro",
    },
    {
      adjective: "Time",
      motif: "Freeze Frame",
      styleTail:
        "bullet-time freeze, orbiting camera, suspended dust, premium VFX finish",
      subjectHint: "an athlete mid-leap",
      aspect: "16:9",
      motion: 4,
      model: "alnabi-cinematic-ultra",
    },
    {
      adjective: "Smoke",
      motif: "Ribbon Curl",
      styleTail:
        "elegant smoke ribbons, rim-lit atmosphere, abstract motion design",
      subjectHint: "a perfume bottle",
      aspect: "9:16",
      motion: 2,
      model: "alnabi-cinematic",
    },
    {
      adjective: "Crystal",
      motif: "Shatter Bloom",
      styleTail:
        "crystal shatter bloom, refractive shards, luminous cores, luxury VFX",
      subjectHint: "a glass heart",
      aspect: "1:1",
      motion: 4,
      model: "alnabi-motion-pro",
    },
  ],
  Product: [
    {
      adjective: "Studio",
      motif: "Hero Orbit",
      styleTail:
        "product hero shot, seamless studio backdrop, softbox lighting, commercial grade",
      subjectHint: "a wireless headphone",
      aspect: "1:1",
      motion: 3,
      model: "alnabi-cinematic",
    },
    {
      adjective: "Luxury",
      motif: "Watch Reveal",
      styleTail:
        "luxury watch commercial, macro details, specular highlights, dark marble set",
      subjectHint: "a premium wristwatch",
      aspect: "16:9",
      motion: 2,
      model: "alnabi-cinematic-ultra",
    },
    {
      adjective: "Beauty",
      motif: "Serum Drop",
      styleTail:
        "beauty product macro, glossy liquid drip, clean pastel set, soft glam light",
      subjectHint: "a skincare bottle",
      aspect: "9:16",
      motion: 2,
      model: "alnabi-motion-pro",
    },
    {
      adjective: "Sneaker",
      motif: "Street Spin",
      styleTail:
        "footwear commercial, 360 spin, urban concrete, punchy contrast grade",
      subjectHint: "a limited sneaker",
      aspect: "1:1",
      motion: 4,
      model: "alnabi-motion-pro",
    },
    {
      adjective: "Tech",
      motif: "Device Unpack",
      styleTail:
        "tech unboxing aesthetic, clean desk, LED accents, precision camera move",
      subjectHint: "a smartphone",
      aspect: "16:9",
      motion: 3,
      model: "alnabi-cinematic",
    },
    {
      adjective: "Food",
      motif: "Steam Rise",
      styleTail:
        "food commercial, rising steam, appetizing color, shallow DOF, premium plate",
      subjectHint: "a gourmet burger",
      aspect: "9:16",
      motion: 2,
      model: "alnabi-cinematic",
    },
    {
      adjective: "Auto",
      motif: "Showroom Glide",
      styleTail:
        "automotive showroom glide, reflective floor, dramatic key light, brand film",
      subjectHint: "a sleek electric car",
      aspect: "16:9",
      motion: 4,
      model: "alnabi-cinematic-ultra",
    },
    {
      adjective: "Pack",
      motif: "Label Focus",
      styleTail:
        "packaging close-up, label readability, soft turntable, e-commerce ready",
      subjectHint: "a coffee bag",
      aspect: "1:1",
      motion: 1,
      model: "alnabi-auto",
    },
  ],
};

const VARIATIONS = [
  "Pulse",
  "Drift",
  "Bloom",
  "Echo",
  "Surge",
  "Mirage",
  "Vertex",
  "Halo",
  "Cascade",
  "Nova",
  "Prism",
  "Orbit",
  "Flux",
  "Aether",
  "Signal",
  "Velvet",
] as const;

const QUALITY_TAGS = [
  "photorealistic, highly detailed",
  "ultra sharp, premium grade",
  "rich color science, filmic contrast",
  "clean composition, masterpiece framing",
] as const;

const CATEGORIES: TemplateCategory[] = [
  "Cinematic",
  "Anime",
  "VFX",
  "Product",
];

/** Build 512 unique Al-Nabi templates (128 per category). */
export function buildStudioTemplateCatalog(count = 512): StudioTemplate[] {
  const out: StudioTemplate[] = [];
  let id = 180;

  // Keep the canonical Cyberpunk entry first (user-provided schema).
  const cyber = SEEDS.Cinematic[0];
  out.push({
    id: id++,
    title: "Cyberpunk Neon Motion",
    category: "Cinematic",
    // Local preview_180.mp4 is optional; use pool to avoid guaranteed 404s.
    preview_video: PREVIEW_POOL[0],
    base_prompt: cyber.styleTail,
    prompt_structure: `{subject}, ${cyber.styleTail}`,
    subject_placeholder: cyber.subjectHint,
    system_preset: {
      aspect_ratio: cyber.aspect,
      motion_level: cyber.motion,
      internal_model: cyber.model,
    },
  });

  const perCategory = Math.ceil((count - 1) / CATEGORIES.length);

  for (const category of CATEGORIES) {
    const seeds = SEEDS[category];
    for (let i = 0; i < perCategory && out.length < count; i++) {
      const seed = seeds[i % seeds.length];
      const variation = VARIATIONS[i % VARIATIONS.length];
      const quality = QUALITY_TAGS[i % QUALITY_TAGS.length];
      const round = Math.floor(i / seeds.length) + 1;
      const title =
        round === 1 && i < seeds.length
          ? `${seed.adjective} ${seed.motif}`
          : `${seed.adjective} ${seed.motif} ${variation}`;

      // Skip exact duplicate of the seeded Cyberpunk title already added.
      if (title === "Cyberpunk Neon Motion" && category === "Cinematic") {
        continue;
      }

      const styleTail = `${seed.styleTail}, ${quality}`;
      const aspect: TemplateAspect =
        i % 7 === 0 ? "9:16" : i % 11 === 0 ? "1:1" : seed.aspect;
      const motion = Math.min(5, Math.max(1, seed.motion + ((i % 3) - 1)));
      const models: AlnabiInternalModel[] = [
        seed.model,
        "alnabi-cinematic",
        "alnabi-motion-pro",
        "alnabi-cinematic-ultra",
        "alnabi-auto",
      ];
      const model = models[i % models.length];
      const previewFallback = PREVIEW_POOL[id % PREVIEW_POOL.length];

      out.push({
        id: id++,
        title,
        category,
        preview_video: previewFallback,
        base_prompt: styleTail,
        prompt_structure: `{subject}, ${styleTail}`,
        subject_placeholder: seed.subjectHint,
        system_preset: {
          aspect_ratio: aspect,
          motion_level: motion,
          internal_model: model,
        },
      });
    }
  }

  return out.slice(0, count);
}
