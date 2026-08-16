/**
 * Studio color themes — CSS variables only; layout unchanged.
 * Persisted as data-theme + localStorage key THEME_STORAGE_KEY.
 */

export const THEME_STORAGE_KEY = "alnabiy_theme";
export const THEME_EVENT = "alnabiy:theme";

export const THEME_IDS = [
  "binafsha",
  "oltin",
  "krem",
  "zumrad",
  "kecha",
  "qizil",
  "yorug",
  "kobalt",
  "pushti",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "binafsha";

export type ThemeMeta = {
  id: ThemeId;
  /** Display name (Uzbek labels as product names) */
  label: string;
  /** Swatch for the picker circle */
  swatch: string;
  /** Secondary swatch (gradient end) */
  swatchEnd: string;
  /** true = light surface (cream / daylight) */
  light: boolean;
};

export const THEMES: ThemeMeta[] = [
  {
    id: "binafsha",
    label: "Binafsha",
    swatch: "#8b5cf6",
    swatchEnd: "#ec4899",
    light: false,
  },
  {
    id: "oltin",
    label: "Oltin",
    swatch: "#f0b429",
    swatchEnd: "#d97706",
    light: false,
  },
  {
    id: "krem",
    label: "Krem",
    swatch: "#e8a622",
    swatchEnd: "#3d3016",
    light: true,
  },
  {
    id: "zumrad",
    label: "Zumrad",
    swatch: "#2dd4bf",
    swatchEnd: "#14b8a6",
    light: false,
  },
  {
    id: "kecha",
    label: "Kecha",
    swatch: "#7c3aed",
    swatchEnd: "#a78bfa",
    light: false,
  },
  {
    id: "qizil",
    label: "Qizil",
    swatch: "#ff4d4d",
    swatchEnd: "#ff8080",
    light: false,
  },
  {
    id: "yorug",
    label: "Yorug'",
    swatch: "#171717",
    swatchEnd: "#525252",
    light: true,
  },
  {
    id: "kobalt",
    label: "Kobalt",
    swatch: "#388bfd",
    swatchEnd: "#58a6ff",
    light: false,
  },
  {
    id: "pushti",
    label: "Pushti",
    swatch: "#f472b6",
    swatchEnd: "#e879a9",
    light: false,
  },
];

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return Boolean(value && (THEME_IDS as readonly string[]).includes(value));
}

export function applyThemeToDocument(theme: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  const meta = THEMES.find((t) => t.id === theme);
  document.documentElement.style.colorScheme = meta?.light ? "light" : "dark";
  const themeColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--nabi-bg")
    .trim();
  if (themeColor) {
    const tag = document.querySelector('meta[name="theme-color"]');
    if (tag) tag.setAttribute("content", themeColor);
  }
}
