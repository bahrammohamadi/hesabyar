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
  type ThemeMode,
} from "@/lib/theme";

function getStoredTheme(): ThemeId {
  return (window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null) ?? DEFAULT_THEME;
}

function getStoredMode(): ThemeMode {
  return (window.localStorage.getItem(MODE_STORAGE_KEY) as ThemeMode | null) ?? DEFAULT_MODE;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Apply mode first, then theme variables. This prevents inline light variables
    // from overriding dark mode and also removes the old yellow/cream flash.
    applyMode(getStoredMode());
    applyTheme(getStoredTheme());

    function handleThemeChanged(event: Event) {
      const custom = event as CustomEvent<ThemeId>;
      applyTheme(custom.detail ?? DEFAULT_THEME);
    }

    function handleModeChanged(event: Event) {
      const custom = event as CustomEvent<ThemeMode>;
      applyMode(custom.detail ?? DEFAULT_MODE);
      applyTheme(getStoredTheme());
    }

    window.addEventListener("hesabyar-theme-change", handleThemeChanged);
    window.addEventListener("hesabyar-mode-change", handleModeChanged);

    const interval = setInterval(() => {
      const currentMode = getStoredMode();
      if (currentMode === "system") {
        applyMode(currentMode);
        applyTheme(getStoredTheme());
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
