/**
 * منطق خالص صفحه‌ی عمومی فروشگاه.
 *
 * در `.ts` جداست تا Vitest بتواند بخواندش — اعتبارسنجی slug و
 * نرمال‌سازی شبکه‌های اجتماعی دقیقاً همان چیزهایی‌اند که باید تست
 * شوند، چون ورودی‌شان مستقیم از کاربر می‌آید.
 */

/** حداکثر کالای نمایشی در ویترین. */
export const STOREFRONT_PRODUCT_LIMIT = 60;

/**
 * قالب مجاز نشانی فروشگاه.
 *
 * ⚠️ باید دقیقاً با قید `storefronts_slug_format` در مهاجرت ۰۰۴۱ یکی
 * بماند. اگر از هم جدا بیفتند، فرم چیزی را می‌پذیرد که دیتابیس رد
 * می‌کند و کاربر خطای نامفهوم می‌گیرد.
 *
 * فقط حروف کوچک لاتین، رقم و خط تیره؛ ۳ تا ۴۰ نویسه؛ نه شروع و نه
 * پایان با خط تیره.
 *
 * چرا حروف فارسی مجاز نیست: در URL به percent-encoding تبدیل
 * می‌شوند و لینکی که در بیو اینستاگرام گذاشته می‌شود زشت و شکننده
 * می‌شود.
 */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/**
 * نشانی‌هایی که نمی‌شود گرفت.
 *
 * چون مسیر `/shop/<slug>` است، تداخل مستقیم با مسیرهای برنامه ندارد؛
 * ولی این نام‌ها در آینده ممکن است زیرمسیر شوند (مثل /shop/admin برای
 * مدیریت ویترین‌ها) و پس‌گرفتنشان از کاربر بدقلق است.
 */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "dashboard", "login", "logout", "register",
  "settings", "shop", "support", "new", "edit", "search", "about",
  "contact", "help", "static", "assets", "public", "www", "test",
]);

export type SlugCheck = { ok: true } | { ok: false; reason: string };

/** اعتبارسنجی نشانی با پیام فارسی قابل نمایش. */
export function validateSlug(raw: unknown): SlugCheck {
  if (typeof raw !== "string") return { ok: false, reason: "نشانی وارد نشده است." };
  const slug = raw.trim().toLowerCase();

  if (slug.length < 3) return { ok: false, reason: "نشانی باید حداقل ۳ نویسه باشد." };
  if (slug.length > 40) return { ok: false, reason: "نشانی نباید بیشتر از ۴۰ نویسه باشد." };
  if (/[^a-z0-9-]/.test(slug)) {
    return { ok: false, reason: "فقط حروف انگلیسی کوچک، عدد و خط تیره مجاز است." };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return { ok: false, reason: "نشانی نباید با خط تیره شروع یا تمام شود." };
  }
  if (RESERVED_SLUGS.has(slug)) return { ok: false, reason: "این نشانی رزرو شده است." };

  return { ok: true };
}

/**
 * پیشنهاد نشانی از روی نام کسب‌وکار.
 *
 * نام‌ها فارسی‌اند و حروف فارسی مجاز نیست، پس معمولاً چیزی باقی
 * نمی‌ماند. در آن حالت `null` برمی‌گردانیم تا فرم چیزی را از پیش پر
 * نکند — پیشنهاد بی‌ربط بدتر از نبودِ پیشنهاد است.
 */
export function suggestSlug(orgName: string | null | undefined): string | null {
  if (!orgName) return null;
  const slug = orgName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return validateSlug(slug).ok ? slug : null;
}

/**
 * نرمال‌سازی نام کاربری اینستاگرام.
 *
 * کاربر ممکن است «@name»، «instagram.com/name» یا آدرس کامل با
 * پارامتر بنویسد. همه به نام خالص تبدیل می‌شوند تا لینک ساخته‌شده
 * همیشه درست باشد.
 */
export function normalizeInstagram(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .trim();
  return value.length > 0 ? value : null;
}

/** همان قاعده برای تلگرام. */
export function normalizeTelegram(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^(t\.me|telegram\.me)\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .trim();
  return value.length > 0 ? value : null;
}

/**
 * شماره‌ی واتس‌اپ به قالب بین‌المللی بدون علامت.
 *
 * ۰۹۱۲… → ۹۸۹۱۲…  چون wa.me کد کشور می‌خواهد و بدون آن لینک
 * برای کاربر خارج از ایران کار نمی‌کند.
 */
export function normalizeWhatsapp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (digits.length === 0) return null;
  if (digits.startsWith("0")) return `98${digits.slice(1)}`;
  return digits;
}

/** نشانی کامل صفحه — برای نمایش و دکمه‌ی کپی. */
export function storefrontUrl(slug: string, origin?: string): string {
  const base = origin ?? "https://tarazooapp.vercel.app";
  return `${base.replace(/\/$/, "")}/shop/${slug}`;
}
