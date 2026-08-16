"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  COSMIC_EVENT,
  COSMIC_STORAGE_KEY,
  COSMIC_THEMES,
  DEFAULT_COSMIC_THEME,
  isCosmicThemeId,
  nextCosmicTheme,
  type CosmicThemeId,
  type CosmicThemeMeta,
} from "@/lib/theme/cosmic";

type CosmicThemeContextValue = {
  theme: CosmicThemeId;
  themes: CosmicThemeMeta[];
  setTheme: (id: CosmicThemeId) => void;
  cycleTheme: () => void;
};

const CosmicThemeContext = createContext<CosmicThemeContextValue | null>(null);

function readStoredCosmicTheme(): CosmicThemeId {
  try {
    const raw = localStorage.getItem(COSMIC_STORAGE_KEY);
    if (isCosmicThemeId(raw)) return raw;
    const asIndex = Number(raw);
    if (
      Number.isInteger(asIndex) &&
      asIndex >= 0 &&
      asIndex < COSMIC_THEMES.length
    ) {
      return COSMIC_THEMES[asIndex]!.id;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_COSMIC_THEME;
}

function persist(id: CosmicThemeId) {
  try {
    localStorage.setItem(COSMIC_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(COSMIC_EVENT, { detail: { theme: id } })
  );
}

export function CosmicThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<CosmicThemeId>(DEFAULT_COSMIC_THEME);

  useEffect(() => {
    setThemeState(readStoredCosmicTheme());
  }, []);

  const setTheme = useCallback((id: CosmicThemeId) => {
    setThemeState(id);
    persist(id);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = nextCosmicTheme(current);
      persist(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, themes: COSMIC_THEMES, setTheme, cycleTheme }),
    [theme, setTheme, cycleTheme]
  );

  return (
    <CosmicThemeContext.Provider value={value}>
      {children}
    </CosmicThemeContext.Provider>
  );
}

export function useCosmicTheme() {
  const ctx = useContext(CosmicThemeContext);
  if (!ctx) {
    throw new Error("useCosmicTheme must be used within CosmicThemeProvider");
  }
  return ctx;
}
