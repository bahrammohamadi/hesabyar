/**
 * بررسی سریع ایمیل در سمت کلاینت.
 *
 * ⚠️ این فقط برای *تجربه‌ی کاربری* است، نه امنیت.
 *   محافظ واقعی تریگر روی auth.users است (migration 0029) که همه‌ی
 *   مسیرها — فرم، REST مستقیم، SDK — از آن عبور می‌کنند.
 *   اینجا فقط پیش از ارسال به کاربر می‌گوییم تا منتظر پاسخ سرور
 *   نماند و پیام واضح‌تری ببیند.
 *
 * فهرست عمداً کوتاه است: تکرار ۸۲۰۰ دامنه در باندل کلاینت،
 * صدها کیلوبایت هدررفت برای چیزی که سرور از قبل چک می‌کند.
 * فقط پرکاربردترین‌ها را داریم.
 */

/** دامنه‌هایی که کاربران بیشتر امتحان می‌کنند. */
const COMMON_DISPOSABLE = new Set([
  "mailinator.com", "tempmail.com", "temp-mail.org", "10minutemail.com",
  "guerrillamail.com", "yopmail.com", "throwawaymail.com", "trashmail.com",
  "getnada.com", "maildrop.cc", "sharklasers.com", "fakeinbox.com",
  "mailnesia.com", "dispostable.com", "mytemp.email", "1secmail.com",
  "moakt.com", "emailondeck.com", "tempmailo.com", "mail.tm",
]);

/**
 * الگوهای عمومی — همان منطق دیتابیس.
 *
 * روی دامنه‌های معتبری که کلمه‌ی مشکوک دارند تست شد و هیچ‌کدام
 * گرفتار نشدند: contemporary.com، templeuniversity.edu، attempt.io
 */
const PATTERNS = [
  /(^|[.-])(temp|tmp|trash|fake|throwaway|disposable|burner|junk|spam|guerrilla|mailinator|yopmail)([.-]|mail|$)/,
  /[0-9]+(minute|min)mail/,
];

/** آیا این ایمیل احتمالاً یک‌بارمصرف است؟ */
export function looksDisposable(email: string | null | undefined): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@").pop()!.trim().toLowerCase();
  if (!domain) return false;

  if (COMMON_DISPOSABLE.has(domain)) return true;
  // زیردامنه: foo.mailinator.com
  for (const d of COMMON_DISPOSABLE) {
    if (domain.endsWith("." + d)) return true;
  }
  return PATTERNS.some((re) => re.test(domain));
}

/** اعتبارسنجی شکل ایمیل — ساده و بدون سخت‌گیری بی‌مورد. */
export function isValidEmailShape(email: string | null | undefined): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email.trim());
}

/**
 * پیام خطای مناسب برای فیلد ایمیل، یا null اگر مشکلی نیست.
 * تفکیک «شکل غلط» از «دامنه‌ی موقت» به کاربر می‌گوید دقیقاً چه
 * چیزی را باید عوض کند.
 */
export function emailError(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return null;
  if (!isValidEmailShape(trimmed)) return "قالب ایمیل درست نیست.";
  if (looksDisposable(trimmed))
    return "ایمیل موقت پذیرفته نمی‌شود. لطفاً از ایمیل اصلی خود (مثلاً جی‌میل) استفاده کنید.";
  return null;
}
