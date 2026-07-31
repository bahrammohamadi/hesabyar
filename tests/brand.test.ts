import { describe, expect, it } from "vitest";
import { BRAND_NAME, BRAND_NAME_EN, BRAND_TITLE } from "../lib/brand";
import { DEFAULT_THEME, getTheme, normalizeThemeId, THEMES } from "../lib/theme";

describe("brand identity", () => {
  it("exposes the Persian product name", () => {
    expect(BRAND_NAME).toBe("ترازو");
    expect(BRAND_NAME_EN).toBe("Tarazoo");
  });

  it("builds the browser title from the brand name", () => {
    expect(BRAND_TITLE.startsWith("ترازو")).toBe(true);
  });

  it("no longer references the previous product names", () => {
    const combined = `${BRAND_NAME} ${BRAND_TITLE}`;
    expect(combined).not.toContain("مهرجامه");
    expect(combined).not.toContain("حساب‌یار");
  });
});

describe("theme id migration after rebrand", () => {
  it("maps the legacy 'mehrjameh' id to the new default theme", () => {
    expect(normalizeThemeId("mehrjameh")).toBe("tarazoo");
    expect(getTheme("mehrjameh").id).toBe("tarazoo");
  });

  it("keeps valid current ids untouched", () => {
    expect(normalizeThemeId("emerald")).toBe("emerald");
  });

  it("falls back to the default for unknown or empty ids", () => {
    expect(normalizeThemeId("does-not-exist")).toBe(DEFAULT_THEME);
    expect(normalizeThemeId(null)).toBe(DEFAULT_THEME);
  });

  it("ships a theme whose id matches the new default", () => {
    expect(THEMES.some((theme) => theme.id === DEFAULT_THEME)).toBe(true);
  });
});
