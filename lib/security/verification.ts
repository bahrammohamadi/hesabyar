import { createHash, randomInt } from "node:crypto";

/**
 * کد تأیید ایمیل.
 *
 * چرا کد ۶ رقمی و نه لینک؟
 *   لینک کاربر را از برنامه بیرون می‌برد؛ روی موبایل به مرورگر
 *   دیگری باز می‌شود و نشست فعلی را گم می‌کند. کد را کاربر در همان
 *   صفحه وارد می‌کند و جریان کارش نمی‌شکند.
 */

/** طول کد. ۶ رقم = یک میلیون حالت؛ با سقف ۵ تلاش عملاً غیرقابل‌حدس. */
const CODE_LENGTH = 6;

/** اعتبار کد. کوتاه‌تر از این آزاردهنده است، بلندتر پنجره‌ی حمله را باز می‌کند. */
export const CODE_TTL_MINUTES = 15;

/** سقف تلاش برای هر کد. */
export const MAX_ATTEMPTS = 5;

/**
 * تولید کد تصادفی.
 *
 * 🔴 `Math.random()` استفاده نمی‌شود: قابل پیش‌بینی است و برای هر
 * چیزی که نقش کلید امنیتی دارد نامناسب. `randomInt` از منبع
 * تصادفی رمزنگاشتی سیستم می‌خواند.
 */
export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/**
 * چکیده‌ی کد برای ذخیره در دیتابیس.
 *
 * کد خام هرگز ذخیره نمی‌شود. اگر روزی نسخه‌ای از دیتابیس درز کند،
 * کدهای فعال در دست مهاجم نباشند — همان قاعده‌ای که برای رمز عبور
 * بدیهی است.
 *
 * ⚠️ نمک با شناسه‌ی کاربر ساخته می‌شود تا دو کاربر با کد یکسان،
 * چکیده‌ی یکسان نداشته باشند (وگرنه جدول رنگین‌کمانی کوچکی کافی بود).
 */
export function hashCode(code: string, userId: string): string {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

/**
 * مقایسه‌ی زمان‌ثابت.
 *
 * مقایسه‌ی معمولی رشته‌ها به‌محض اولین اختلاف برمی‌گردد و اختلاف
 * زمانی، رقم‌به‌رقم بودن کد را لو می‌دهد. برای ۶ رقم حمله‌ی عملی
 * بعید است، ولی هزینه‌ی نوشتن درستش صفر است.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** آیا این ایمیل شکل معتبری دارد؟ گارد سبک پیش از هر کار دیگر. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value.trim());
}
