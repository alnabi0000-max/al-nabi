export const COSMIC_STORAGE_KEY = "alnabiy_cosmic_theme";
export const COSMIC_EVENT = "alnabiy:cosmic";

export const COSMIC_THEME_IDS = [
  "pandora",
  "nebula",
  "aurora",
  "grotto",
  "vortex",
  "plasma",
  "warp",
  "abyss",
  "matrix",
  "golden",
] as const;

export type CosmicThemeId = (typeof COSMIC_THEME_IDS)[number];

export const DEFAULT_COSMIC_THEME: CosmicThemeId = "pandora";

export type CosmicThemeMeta = {
  id: CosmicThemeId;
  label: string;
};

export const COSMIC_THEMES: CosmicThemeMeta[] = [
  { id: "pandora", label: "Pandora Bioluminescence" },
  { id: "nebula", label: "Deep Space Nebula" },
  { id: "aurora", label: "Cyber Aurora" },
  { id: "grotto", label: "Bioluminescent Grotto" },
  { id: "vortex", label: "Nebula Vortex" },
  { id: "plasma", label: "Plasma Energy Grid" },
  { id: "warp", label: "Quantum Warp" },
  { id: "abyss", label: "Deep Ocean Abyss" },
  { id: "matrix", label: "Emerald Cyber Matrix" },
  { id: "golden", label: "Golden Galaxy" },
];

export function isCosmicThemeId(
  value: string | null | undefined
): value is CosmicThemeId {
  return Boolean(
    value && (COSMIC_THEME_IDS as readonly string[]).includes(value)
  );
}

export function nextCosmicTheme(current: CosmicThemeId): CosmicThemeId {
  const index = COSMIC_THEME_IDS.indexOf(current);
  return COSMIC_THEME_IDS[(index + 1) % COSMIC_THEME_IDS.length]!;
}

export function cosmicThemeLabel(id: CosmicThemeId): string {
  return COSMIC_THEMES.find((item) => item.id === id)?.label ?? id;
}
