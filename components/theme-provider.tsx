"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "nexus" | "claro";
const STORAGE_KEY = "credix.theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("nexus");

  useEffect(() => {
    let initial: Theme = "nexus";
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (saved === "nexus" || saved === "claro") initial = saved;
    } catch {
      /* ignore */
    }
    // Sincroniza estado React con el atributo del DOM (evita desincronizacion toggle/colores).
    setThemeState(initial);
    if (typeof document !== "undefined") document.documentElement.dataset.theme = initial;
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    if (typeof document !== "undefined") document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
