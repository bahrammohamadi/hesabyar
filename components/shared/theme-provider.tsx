"use client";

import { useEffect, type ReactNode } from "react";
import {
  applyTheme,
  applyMode,
  DEFAULT_THEME,
  DEFAULT_MODE,
  THEME_STORAGE_KEY,
  MODE_STORAGE_KEY,
  LEGACY_THEME_STORAGE_KEY,
  LEGACY_MODE_STORAGE_KEY,
  THEME_CHANGE_EVENT,
  MODE_CHANGE_EVENT,
  normalizeThemeId,
  type ThemeId,
  type ThemeMode,
} from "@/lib/theme";

/**
 * تم ذخیره‌شده را می‌خواند. اگر کاربر هنوز کلید قدیمی (پیش از تغییر نام برند)
 * را داشته باشد، مقدارش خوانده و یک‌بار به کلید جدید منتقل می‌شود تا
 * انتخاب او پس از تغییر نام از بین نرود.
 */
function getStoredTheme(): ThemeId {
  const current = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (current) return normalizeThemeId(current);

  const legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
  if (legacy) {
    const migrated = normalizeThemeId(legacy);
    window.localStorage.setItem(THEME_STORAGE_KEY, migrated);
    return migrated;
  }
  return DEFAULT_THEME;
}

function getStoredMode(): ThemeMode {
  const current = window.localStorage.getItem(MODE_STORAGE_KEY) as ThemeMode | null;
  if (current) return current;

  const legacy = window.localStorage.getItem(LEGACY_MODE_STORAGE_KEY) as ThemeMode | null;
  if (legacy) {
    window.localStorage.setItem(MODE_STORAGE_KEY, legacy);
    return legacy;
  }
  return DEFAULT_MODE;
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

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChanged);
    window.addEventListener(MODE_CHANGE_EVENT, handleModeChanged);

    const interval = setInterval(() => {
      const currentMode = getStoredMode();
      if (currentMode === "system") {
        applyMode(currentMode);
        applyTheme(getStoredTheme());
      }
    }, 60000);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChanged);
      window.removeEventListener(MODE_CHANGE_EVENT, handleModeChanged);
      clearInterval(interval);
    };
  }, []);

  return children;
}
