/**
 * ترجیحات سازمان: واحد پول و شخصی‌سازی صنفی.
 *
 * ⚠️ هیچ وابستگی به `node:` ندارد — از کامپوننت کلاینت خوانده
 * می‌شود. همان درسی که با `node:crypto` گرفتیم.
 *
 * 🔴 قاعده‌ی بنیادی این فایل:
 *   **دیتابیس همیشه ریال است.** هیچ‌وقت مقدار ذخیره‌شده تغییر
 *   نمی‌کند؛ فقط نمایش و ورودی عوض می‌شوند.
 *
 *   چرا؟ اگر واحد ذخیره‌سازی قابل تغییر بود، عوض‌کردن آن یعنی
 *   بازنویسی هر مبلغ در `sales`، `purchases`، `transactions`،
 *   `sale_items`… روی داده‌ی واقعی. یک خطا در آن مهاجرت یعنی
 *   دفتر مالی نابود. نرم‌افزارهای ایرانی هم همین کار را می‌کنند:
 *   چندارزی واقعی را محصول جداگانه می‌فروشند (هلو/سپیدار نسخه‌ی
 *   صرافی) و در نسخه‌ی عادی فقط واحد *نمایش* را عوض می‌کنند.
 */

import { BUSINESS_TYPES } from "./business-types";

/* ------------------------------------------------------------------ */
/* واحد پول                                                            */
/* ------------------------------------------------------------------ */

export type CurrencyCode = "toman" | "rial";

export const CURRENCIES: Record<
  CurrencyCode,
  { label: string; short: string; /** ضریب تبدیل از ریالِ ذخیره‌شده */ divisor: number }
> = {
  toman: { label: "تومان", short: "تومان", divisor: 10 },
  rial: { label: "ریال", short: "ریال", divisor: 1 },
};

export const DEFAULT_CURRENCY: CurrencyCode = "toman";

export function isCurrencyCode(v: unknown): v is CurrencyCode {
  return v === "toman" || v === "rial";
}

/* ------------------------------------------------------------------ */
/* شخصی‌سازی صنفی                                                      */
/* ------------------------------------------------------------------ */

/**
 * برچسب‌ها و پیش‌فرض‌های هر صنف.
 *
 * ⚠️ فقط چیزهایی اینجاست که **واقعاً** در پنل اثر دارد. وسوسه‌ی این
 * جدول آن است که برای هر صنف وعده‌ی چیزی بدهیم که نداریم — همان
 * قاعده‌ی سخت `lib/industries.ts`.
 *
 * `hiddenFields` فقط فیلدهای **اختیاری** را پنهان می‌کند. هیچ فیلد
 * لازمی پنهان نمی‌شود، وگرنه کاربر نمی‌فهمد چرا فرم ذخیره نمی‌شود.
 */
export type IndustryProfile = {
  /** «کالا» در رستوران می‌شود «آیتم منو». */
  productWord: string;
  /** واحد پیش‌فرض کالای تازه. */
  defaultUnit: "count" | "weight" | "volume" | "length";
  /** فیلدهای اختیاری که برای این صنف بی‌معنی‌اند. */
  hiddenFields: Array<"color" | "size" | "season" | "material">;
  /** گزینه‌های پیشنهادی فهرست‌های کشویی. */
  suggested: Partial<Record<"color" | "size" | "season" | "material" | "unit", string[]>>;
};

const GENERIC: IndustryProfile = {
  productWord: "کالا",
  defaultUnit: "count",
  hiddenFields: [],
  suggested: {
    unit: ["عدد", "بسته", "کیلوگرم", "متر", "لیتر"],
  },
};

export const INDUSTRY_PROFILES: Record<string, IndustryProfile> = {
  apparel: {
    productWord: "کالا",
    defaultUnit: "count",
    hiddenFields: [],
    suggested: {
      color: ["مشکی", "سفید", "کرم", "سرمه‌ای", "قرمز", "آبی", "سبز", "صورتی", "طوسی", "قهوه‌ای"],
      size: ["XS", "S", "M", "L", "XL", "XXL", "فری‌سایز", "۳۶", "۳۸", "۴۰", "۴۲", "۴۴"],
      season: ["بهار و تابستان", "پاییز و زمستان", "چهارفصل"],
      material: ["نخ", "لینن", "کتان", "ویسکوز", "پلی‌استر", "جین", "مخمل", "کرپ"],
      unit: ["عدد", "دست", "جفت"],
    },
  },
  cafe: {
    productWord: "آیتم منو",
    defaultUnit: "count",
    // رنگ و سایز و فصل برای قهوه بی‌معنی است.
    hiddenFields: ["color", "size", "season", "material"],
    suggested: { unit: ["عدد", "پرس", "لیوان", "کیلوگرم", "لیتر"] },
  },
  grocery: {
    productWord: "کالا",
    // 🔴 سوپرمارکت پیش‌فرض وزنی است — میوه و گوشت و حبوبات.
    defaultUnit: "weight",
    hiddenFields: ["color", "size", "season", "material"],
    suggested: { unit: ["کیلوگرم", "گرم", "عدد", "بسته", "کارتن", "شانه", "لیتر"] },
  },
  pharmacy: {
    productWord: "قلم دارویی",
    defaultUnit: "count",
    hiddenFields: ["color", "size", "season", "material"],
    suggested: { unit: ["عدد", "بسته", "قوطی", "تیوب", "شیشه", "ورق"] },
  },
  mobile: {
    productWord: "کالا",
    defaultUnit: "count",
    hiddenFields: ["season", "material"],
    suggested: {
      color: ["مشکی", "سفید", "طلایی", "نقره‌ای", "آبی", "بنفش", "سبز"],
      size: ["۶۴ گیگ", "۱۲۸ گیگ", "۲۵۶ گیگ", "۵۱۲ گیگ", "۱ ترابایت"],
      unit: ["عدد", "بسته"],
    },
  },
  jewelry: {
    productWord: "مصنوع",
    // 🔴 طلا وزنی است؛ پیش‌فرض شمارشی یعنی هر بار دستی عوض کردن.
    defaultUnit: "weight",
    hiddenFields: ["season"],
    suggested: {
      color: ["زرد", "سفید", "رزگلد"],
      material: ["طلای ۱۸ عیار", "طلای ۲۴ عیار", "نقره", "پلاتین", "بدلیجات"],
      size: ["۵۰", "۵۲", "۵۴", "۵۶", "۵۸", "۶۰"],
      unit: ["گرم", "عدد", "مثقال"],
    },
  },
  bakery: {
    productWord: "محصول",
    defaultUnit: "count",
    hiddenFields: ["color", "size", "season", "material"],
    suggested: { unit: ["عدد", "کیلوگرم", "گرم", "جعبه", "قالب"] },
  },
  hardware: {
    productWord: "کالا",
    defaultUnit: "count",
    hiddenFields: ["season"],
    suggested: {
      color: ["مشکی", "سفید", "نقره‌ای", "استیل"],
      size: ["کوچک", "متوسط", "بزرگ"],
      material: ["فلز", "پلاستیک", "چوب", "شیشه", "استیل"],
      unit: ["عدد", "بسته", "کارتن", "متر", "کیلوگرم"],
    },
  },
  stationery: {
    productWord: "کالا",
    defaultUnit: "count",
    hiddenFields: ["season", "material"],
    suggested: {
      color: ["مشکی", "آبی", "قرمز", "سبز", "رنگی"],
      size: ["A4", "A5", "A3", "رحلی", "جیبی"],
      unit: ["عدد", "بسته", "جلد", "بند", "کارتن"],
    },
  },
  other: GENERIC,
};

/** پروفایل یک صنف؛ برای شناسه‌ی ناشناخته یا خالی، پروفایل عمومی. */
export function industryProfile(businessType: string | null | undefined): IndustryProfile {
  if (!businessType) return GENERIC;
  return INDUSTRY_PROFILES[businessType] ?? GENERIC;
}

/** آیا این فیلد اختیاری برای این صنف نمایش داده شود؟ */
export function showsField(
  businessType: string | null | undefined,
  field: "color" | "size" | "season" | "material"
): boolean {
  return !industryProfile(businessType).hiddenFields.includes(field);
}

/* ------------------------------------------------------------------ */
/* شکل ترجیحات                                                         */
/* ------------------------------------------------------------------ */

export type OrgPrefs = {
  currency: CurrencyCode;
  /** خالی یعنی از صنف سازمان گرفته شود. */
  businessType: string | null;
  /** کاربر می‌تواند شخصی‌سازی صنفی را کلاً خاموش کند. */
  industryUi: boolean;
};

export const DEFAULT_PREFS: OrgPrefs = {
  currency: DEFAULT_CURRENCY,
  businessType: null,
  industryUi: true,
};

/**
 * خواندن امن ترجیحات از jsonb.
 *
 * ⚠️ هر مقدار نامعتبر به پیش‌فرض برمی‌گردد، نه خطا. این داده از
 * دیتابیس می‌آید و ممکن است دستی ویرایش شده باشد؛ یک مقدار خراب
 * نباید کل پنل را از کار بیندازد.
 */
export function parsePrefs(raw: unknown): OrgPrefs {
  const o = (raw ?? {}) as Record<string, unknown>;
  const bt = typeof o.businessType === "string" && o.businessType ? o.businessType : null;
  return {
    currency: isCurrencyCode(o.currency) ? o.currency : DEFAULT_CURRENCY,
    businessType: bt,
    industryUi: o.industryUi === false ? false : true,
  };
}

/** صنف مؤثر: ترجیح صریح، وگرنه صنف ثبت‌شده‌ی سازمان. */
export function effectiveBusinessType(
  prefs: OrgPrefs,
  orgBusinessType: string | null | undefined
): string | null {
  if (!prefs.industryUi) return null;
  return prefs.businessType ?? orgBusinessType ?? null;
}

/** برچسب فارسی صنف برای نمایش در فرم تنظیمات. */
export function businessTypeOptions() {
  return BUSINESS_TYPES.map((t) => ({ id: t.id, label: `${t.emoji} ${t.label}` }));
}
