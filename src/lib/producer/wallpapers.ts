/**
 * Producer Chat wallpaper presets — cycle via 🎨 toggle.
 */

export type ChatWallpaper = {
  id: string;
  label: string;
  /** CSS class applied to the message scroll surface */
  className: string;
};

export const CHAT_WALLPAPERS: ChatWallpaper[] = [
  {
    id: "dark-glass",
    label: "Dark Glass",
    className: "pc-wall-dark-glass",
  },
  {
    id: "cyberpunk-grid",
    label: "Cyberpunk Grid",
    className: "pc-wall-cyberpunk",
  },
  {
    id: "heart-pattern",
    label: "Heart Pattern",
    className: "pc-wall-hearts",
  },
  {
    id: "cosmic-nebula",
    label: "Cosmic Nebula",
    className: "pc-wall-nebula",
  },
  {
    id: "minimal-subtle",
    label: "Minimal Subtle",
    className: "pc-wall-minimal",
  },
  {
    id: "abstract-lines",
    label: "Abstract Lines",
    className: "pc-wall-lines",
  },
  {
    id: "aurora",
    label: "Aurora",
    className: "pc-wall-aurora",
  },
  {
    id: "deep-ocean",
    label: "Deep Ocean",
    className: "pc-wall-ocean",
  },
  {
    id: "ember-fade",
    label: "Ember Fade",
    className: "pc-wall-ember",
  },
  {
    id: "mint-haze",
    label: "Mint Haze",
    className: "pc-wall-mint",
  },
  {
    id: "noir-dots",
    label: "Noir Dots",
    className: "pc-wall-dots",
  },
  {
    id: "sunset-mesh",
    label: "Sunset Mesh",
    className: "pc-wall-sunset",
  },
  {
    id: "slate-noise",
    label: "Slate Noise",
    className: "pc-wall-noise",
  },
  {
    id: "violet-mist",
    label: "Violet Mist",
    className: "pc-wall-violet",
  },
  {
    id: "carbon-fiber",
    label: "Carbon Fiber",
    className: "pc-wall-carbon",
  },
];

export const WALLPAPER_LS_KEY = "alnabiy_producer_wallpaper";

export function readWallpaperIndex(): number {
  try {
    const raw = localStorage.getItem(WALLPAPER_LS_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    if (!Number.isFinite(n)) return 0;
    return ((n % CHAT_WALLPAPERS.length) + CHAT_WALLPAPERS.length) %
      CHAT_WALLPAPERS.length;
  } catch {
    return 0;
  }
}

export function writeWallpaperIndex(index: number) {
  try {
    localStorage.setItem(WALLPAPER_LS_KEY, String(index));
  } catch {
    /* soft */
  }
}
