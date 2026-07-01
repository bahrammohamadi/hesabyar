"use client";

import { useEffect, type ReactNode } from "react";
import { 
  applyTheme, 
  applyMode, 
  DEFAULT_THEME, 
  DEFAULT_MODE, 
  THEME_STORAGE_KEY, 
  MODE_STORAGE_KEY, 
  type ThemeId, 
  type ThemeMode 
} from "@/lib/theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Initial application
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    const storedMode = window.localStorage.getItem(MODE_STORAGE_KEY) as ThemeMode | null;
    
    applyTheme(storedTheme ?? DEFAULT_THEME);
    applyMode(storedMode ?? DEFAULT_MODE);

    // Listen for theme changes
    function handleThemeChanged(event: Event) {
      const custom = event as CustomEvent<ThemeId>;
      applyTheme(custom.detail ?? DEFAULT_THEME);
    }

    // Listen for mode changes
    function handleModeChanged(event: Event) {
      const custom = event as CustomEvent<ThemeMode>;
      applyMode(custom.detail ?? DEFAULT_MODE);
    }

    window.addEventListener("hesabyar-theme-change", handleThemeChanged);
    window.addEventListener("hesabyar-mode-change", handleModeChanged);

    // Check for time-based mode change every minute if mode is 'system'
    const interval = setInterval(() => {
      const currentMode = window.localStorage.getItem(MODE_STORAGE_KEY) as ThemeMode | null;
      if (currentMode === "system" || !currentMode) {
        applyMode(currentMode ?? DEFAULT_MODE);
      }
    }, 60000);

    return () => {
      window.removeEventListener("hesabyar-theme-change", handleThemeChanged);
      window.removeEventListener("hesabyar-mode-change", handleModeChanged);
      clearInterval(interval);
    };
  }, []);

  return children;
}
