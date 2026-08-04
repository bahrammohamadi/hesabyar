/**
 * تنظیمات شخصی نوار بازار.
 *
 * چرا localStorage و نه دیتابیس؟
 *   این یک ترجیح نمایشی است، نه داده‌ی کسب‌وکار. ذخیره در دیتابیس
 *   یعنی یک درخواست شبکه در هر بارگذاری صفحه برای چیزی که فقط روی
 *   همین مرورگر معنا دارد. اگر روزی «همگام‌سازی بین دستگاه‌ها» لازم
 *   شد، فقط `load`/`save` عوض می‌شود.
 *
 * ⚠️ کلید شامل شناسه‌ی کاربر نیست چون در یک مرورگر معمولاً یک کاربر
 * کار می‌کند و ترجیح نمایشی هم حساس نیست.
 */

import { DEFAULT_QUOTE_IDS, VALID_QUOTE_IDS } from "./providers";
import { DEFAULT_CITY_ID, IRAN_CITIES } from "./weather";

export interface TickerPrefs {
  /** نوار اصلاً نمایش داده شود؟ */
  enabled: boolean;
  /** کاشی آب‌وهوا نمایش داده شود؟ */
  showWeather: boolean;
  cityId: string;
  /** شناسه‌ی قیمت‌های انتخاب‌شده، به همان ترتیبی که کاربر چیده. */
  quoteIds: string[];
}

export const STORAGE_KEY = "tarazoo.ticker.v1";

export const DEFAULT_PREFS: TickerPrefs = {
  enabled: true,
  showWeather: true,
  cityId: DEFAULT_CITY_ID,
  quoteIds: [...DEFAULT_QUOTE_IDS],
};

const VALID_CITY_IDS = new Set(IRAN_CITIES.map((c) => c.id));

/**
 * پاک‌سازی مقدار خوانده‌شده.
 *
 * 🔴 چرا لازم است: localStorage را کاربر یا افزونه‌ها می‌توانند
 * دستکاری کنند، و مهم‌تر — نسخه‌های بعدی ممکن است نمادی را حذف کنند.
 * بدون این پاک‌سازی، یک شناسه‌ی نامعتبر باعث می‌شود آن کاشی هرگز
 * رندر نشود و کاربر فکر کند نوار خراب است.
 */
export function sanitize(raw: unknown): TickerPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFS };
  const input = raw as Partial<TickerPrefs>;

  const ids = Array.isArray(input.quoteIds)
    ? input.quoteIds.filter((id): id is string => typeof id === "string" && VALID_QUOTE_IDS.has(id))
    : [];

  return {
    enabled: typeof input.enabled === "boolean" ? input.enabled : DEFAULT_PREFS.enabled,
    showWeather: typeof input.showWeather === "boolean" ? input.showWeather : DEFAULT_PREFS.showWeather,
    cityId: typeof input.cityId === "string" && VALID_CITY_IDS.has(input.cityId) ? input.cityId : DEFAULT_CITY_ID,
    // تکراری‌ها حذف می‌شوند؛ آرایه‌ی خالی مجاز است (کاربر همه را برداشته).
    quoteIds: Array.from(new Set(ids)),
  };
}

export function loadPrefs(): TickerPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return sanitize(JSON.parse(raw));
  } catch {
    // JSON خراب یا localStorage غیرفعال (حالت ناشناس در بعضی مرورگرها)
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: TickerPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    /*
      رویداد سفارشی: اگر نوار در چند جا رندر شده باشد (یا تنظیمات در
      یک مودال جدا باز باشد)، همه بی‌درنگ هماهنگ می‌شوند.
      رویداد بومی `storage` فقط در *سایر* تب‌ها شلیک می‌شود، نه همین تب.
    */
    window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: prefs }));
  } catch {
    // سهمیه‌ی پر یا حالت محدود — بی‌صدا رد می‌شود، ترجیح نمایشی حیاتی نیست.
  }
}

export const PREFS_EVENT = "tarazoo:ticker-prefs";

/** جابه‌جایی یک آیتم در فهرست — برای مرتب‌سازی دستی کاربر. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
