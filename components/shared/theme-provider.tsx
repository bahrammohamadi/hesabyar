"use client";

import { useEffect, type ReactNode } from "react";
import { applyTheme, DEFAULT_THEME, THEME_STORAGE_KEY, type ThemeId } from "@/lib/theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    applyTheme(stored ?? DEFAULT_THEME);

    function handleThemeChanged(event: Event) {
      const custom = event as CustomEvent<ThemeId>;
      applyTheme(custom.detail ?? DEFAULT_THEME);
    }

    window.addEventListener("hesabyar-theme-change", handleThemeChanged);
    return () => window.removeEventListener("hesabyar-theme-change", handleThemeChanged);
  }, []);

  return children;
}
