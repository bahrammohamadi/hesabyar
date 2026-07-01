export type ThemeId = "mehrjameh" | "emerald" | "royal" | "copper" | "slate" | "violet";
export type ThemeMode = "light" | "dark" | "system";

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  description: string;
  swatches: string[];
  vars: Record<string, string>;
  // Semantic HSL tokens for shadcn/ui compatibility
  primaryHsl: string;
  primaryForegroundHsl: string;
  accentHsl?: string;
};

function brandScale(primary: string[], accent: string[], options?: {
  primaryHsl?: string;
  primaryForegroundHsl?: string;
  ringHsl?: string;
}) {
  const base = {
    "--brand-50": primary[0],
    "--brand-100": primary[1],
    "--brand-200": primary[2],
    "--brand-300": primary[3],
    "--brand-400": primary[4],
    "--brand-500": primary[5],
    "--brand-600": primary[6],
    "--brand-700": primary[7],
    "--brand-800": primary[8],
    "--brand-900": primary[9],
    "--rose-50": accent[0],
    "--rose-100": accent[1],
    "--rose-200": accent[2],
    "--rose-300": accent[3],
    "--rose-400": accent[4],
    "--rose-500": accent[5],
    "--rose-600": accent[6],
    "--rose-700": accent[7],
  };

  // Add semantic CSS variables so buttons using bg-primary also theme correctly
  if (options?.primaryHsl) {
    return {
      ...base,
      "--primary": options.primaryHsl,
      "--primary-foreground": options.primaryForegroundHsl ?? "0 0% 100%",
      "--ring": options.ringHsl ?? options.primaryHsl,
      // make accent a lighter tint
      "--accent": options.primaryHsl.replace(/(\d+)\s+(\d+%?)\s+(\d+%?)/, (_, h, s, l) => {
        // lighten a bit for accent background in light mode
        const lightness = parseInt(l);
        return `${h} ${s} ${Math.min(96, lightness + 50)}%`;
      }),
      "--accent-foreground": options.primaryHsl,
    };
  }
  return base;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "mehrjameh",
    name: "مهرجامه اصلی",
    description: "سبز یشمی عمیق + صورتی ملایم، هماهنگ با لوگوی ارسالی",
    swatches: ["#136451", "#0f4f41", "#ec8b98"],
    primaryHsl: "165 65% 24%",
    primaryForegroundHsl: "0 0% 100%",
    vars: brandScale(
      ["240 248 245", "210 235 225", "175 215 200", "130 190 170", "75 160 140", "35 130 110", "19 100 81", "15 79 65", "12 63 52", "10 51 43"],
      ["253 238 240", "250 215 220", "244 179 188", "236 139 152", "227 114 127", "215 109 122", "194 85 99", "162 63 76"],
      { primaryHsl: "165 65% 24%", primaryForegroundHsl: "0 0% 100%", ringHsl: "165 65% 32%" }
    ),
  },
  {
    id: "emerald",
    name: "فروشگاهی سبز",
    description: "سبز مدرن و روشن برای POS سریع و خوانا",
    swatches: ["#059669", "#047857", "#f97316"],
    primaryHsl: "160 84% 39%",
    primaryForegroundHsl: "0 0% 100%",
    vars: brandScale(
      ["240 253 245", "209 250 229", "167 243 208", "110 231 183", "52 211 153", "16 185 129", "5 150 105", "4 120 87", "6 95 70", "6 78 59"],
      ["255 247 237", "255 237 213", "254 215 170", "253 186 116", "251 146 60", "249 115 22", "234 88 12", "194 65 12"],
      { primaryHsl: "160 84% 39%", primaryForegroundHsl: "0 0% 98%", ringHsl: "160 84% 39%" }
    ),
  },
  {
    id: "royal",
    name: "آبی مدیریتی",
    description: "آبی عمیق و امن برای حس مالی/مدیریتی",
    swatches: ["#2563eb", "#1e40af", "#a855f7"],
    primaryHsl: "221 83% 53%",
    primaryForegroundHsl: "0 0% 100%",
    vars: brandScale(
      ["242 247 255", "225 236 255", "195 218 254", "150 190 250", "90 155 245", "55 125 240", "37 99 235", "29 78 216", "30 64 175", "30 58 138"],
      ["250 245 255", "243 232 255", "233 213 255", "216 180 254", "192 132 252", "168 85 247", "147 51 234", "126 34 206"],
      { primaryHsl: "221 83% 53%", primaryForegroundHsl: "0 0% 100%", ringHsl: "221 83% 53%" }
    ),
  },
  {
    id: "copper",
    name: "گرم و لوکس",
    description: "قهوه‌ای مسی شیک - مناسب پوشاک و بوتیک (نسخه بهبود یافته بدون زردی)",
    swatches: ["#a65a2a", "#8b4513", "#be123c"],
    primaryHsl: "25 60% 40%",
    primaryForegroundHsl: "30 20% 98%",
    vars: brandScale(
      // بازطراحی شده: کرم گرم خنثی، بدون زردی آزاردهنده
      ["252 248 243", "245 235 220", "230 210 180", "205 170 135", "180 130 90", "155 95 55", "146 64 32", "120 53 25", "90 40 18", "60 28 12"],
      ["255 241 242", "255 228 230", "254 205 211", "253 164 175", "251 113 133", "244 63 94", "225 29 72", "190 18 60"],
      { primaryHsl: "25 60% 40%", primaryForegroundHsl: "30 20% 98%", ringHsl: "25 60% 45%" }
    ),
  },
  {
    id: "slate",
    name: "مینیمال حرفه‌ای",
    description: "خاکستری/نفتی برای محیط کاری خلوت و حرفه‌ای",
    swatches: ["#334155", "#0f172a", "#14b8a6"],
    primaryHsl: "215 25% 27%",
    primaryForegroundHsl: "0 0% 100%",
    vars: brandScale(
      ["248 250 252", "241 245 249", "226 232 240", "203 213 225", "148 163 184", "100 116 139", "71 85 105", "51 65 85", "30 41 59", "15 23 42"],
      ["240 253 250", "204 251 241", "153 246 228", "94 234 212", "45 212 191", "20 184 166", "13 148 136", "15 118 110"],
      { primaryHsl: "215 25% 27%", primaryForegroundHsl: "0 0% 100%", ringHsl: "215 20% 40%" }
    ),
  },
  {
    id: "violet",
    name: "بنفش خلاق",
    description: "بنفش مدرن برای برندهای خلاق و فناوری",
    swatches: ["#7c3aed", "#6d28d9", "#ec4899"],
    primaryHsl: "262 83% 58%",
    primaryForegroundHsl: "0 0% 100%",
    vars: brandScale(
      ["250 245 255", "237 224 255", "215 190 250", "185 150 240", "155 110 230", "124 58 237", "109 40 217", "91 33 182", "76 29 149", "59 22 110"],
      ["253 244 255", "250 232 255", "245 208 254", "240 171 252", "232 121 249", "217 70 239", "192 38 211", "162 28 175"]
    ),
  },
];

export const DEFAULT_THEME: ThemeId = "mehrjameh";
export const DEFAULT_MODE: ThemeMode = "system";
export const THEME_STORAGE_KEY = "hesabyar-theme";
export const MODE_STORAGE_KEY = "hesabyar-mode";

export function getTheme(id?: string | null) {
  return THEMES.find((theme) => theme.id === id) ?? THEMES.find((theme) => theme.id === DEFAULT_THEME)!;
}

export function isNightTime() {
  const hour = new Date().getHours();
  return hour >= 20 || hour < 7; // 8 PM to 7 AM
}

export function applyTheme(id?: string | null) {
  if (typeof document === "undefined") return;
  const theme = getTheme(id);
  Object.entries(theme.vars).forEach(([key, value]) => document.documentElement.style.setProperty(key, value));
  document.documentElement.dataset.theme = theme.id;
}

export function applyMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  
  let effectiveMode = mode;
  if (mode === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const night = isNightTime();
    effectiveMode = (prefersDark || night) ? "dark" : "light";
  }

  if (effectiveMode === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}
