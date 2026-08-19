/**
 * بازیابی رمز عبور — بخش ایزومورفیک (سرور و مرورگر).
 *
 * 🔴 چرا این فایل از `recovery.ts` جدا شد؟
 *
 *   صفحه‌ی /reset-password یک کامپوننت کلاینت است و به
 *   `RESET_CODE_LENGTH` نیاز دارد. وقتی همان فایلی را import می‌کرد
 *   که `node:crypto` داشت، وب‌پک کل ماژول را داخل باندل مرورگر
 *   می‌کشید و build می‌شکست:
 *
 *     UnhandledSchemeError: Reading from "node:crypto" is not handled
 *
 *   ⚠️ انتقال `require` به داخل بدنه‌ی تابع کافی **نبود** — وب‌پک آن
 *   را هم به‌صورت ایستا تحلیل می‌کند. تنها راه، جداکردن فایل بر
 *   اساس مرز سرور/کلاینت است.
 *
 *   ⚠️ این باگ را نه `tsc` گرفت و نه ۱۴۲۰ تست؛ فقط `next build`.
 *
 * اینجا فقط منطق خالص می‌ماند. تولید و هش کد در `recovery.ts` است
 * که فقط از سرور خوانده می‌شود.
 */

/** دامنه‌ی ایمیل ساختگی که هنگام ثبت‌نام با شماره ساخته می‌شود. */
export const SYNTHETIC_EMAIL_DOMAIN = "@hesabyar.app";

/** طول کد بازیابی. */
export const RESET_CODE_LENGTH = 8;

/** حداکثر تلاش برای وارد کردن کد. */
export const MAX_RESET_ATTEMPTS = 5;

/**
 * آیا این حساب ایمیل واقعی دارد؟
 *
 * 🔴 چرا حیاتی است: ۴ از ۶ کاربر فعلی با شماره‌ی موبایل ثبت‌نام
 * کرده‌اند و آدرسشان `09121234567@hesabyar.app` است — صندوقی وجود
 * ندارد. اگر لینک بازیابی به آنجا بفرستیم، کاربر تا ابد منتظر
 * ایمیلی می‌ماند که هرگز نمی‌رسد و **دلیلش را هم نمی‌فهمد**.
 */
export function hasRealEmail(loginId: string | null | undefined): boolean {
  const clean = (loginId ?? "").trim().toLowerCase();
  if (!clean.includes("@")) return false;
  if (clean.endsWith(SYNTHETIC_EMAIL_DOMAIN)) return false;
  // ساده‌ترین اعتبارسنجی که کار می‌کند؛ اعتبارسنجی واقعی را خود
  // سرویس ایمیل انجام می‌دهد.
  return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(clean);
}

/**
 * ارقام فارسی و عربی را به لاتین تبدیل و فاصله‌ها را حذف می‌کند.
 *
 * 🔴 بدون این، کاربری که با کیبورد فارسی «۱۲۳۴۵۶۷۸» را تایپ می‌کند
 * کد **درست** را وارد کرده ولی «کد اشتباه است» می‌گیرد — و پس از
 * پنج بار، سهمیه‌اش تمام می‌شود بدون آنکه هیچ اشتباهی کرده باشد.
 */
export function normalizeCodeInput(input: string): string {
  return (input ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[\s-]/g, "");
}

/**
 * آیا کد وارد‌شده از نظر شکلی معتبر است؟
 *
 * پیش از هر تماس با دیتابیس بررسی می‌شود تا ورودی آشکارا غلط
 * سهمیه‌ی تلاش کاربر را نسوزاند.
 */
export function isWellFormedCode(input: string): boolean {
  return new RegExp(`^\\d{${RESET_CODE_LENGTH}}$`).test(normalizeCodeInput(input));
}

/**
 * پوشاندن شناسه‌ی ورود برای نمایش.
 *
 * 🔴 چرا لازم است: صفحه‌ی «کد را برای چه کسی بسازم» فهرست کاربران را
 * نشان می‌دهد. نمایش کامل ایمیل و شماره در صفحه‌ای که ممکن است کسی
 * از پشت سر ببیند، نشت اطلاعات است.
 *
 *   09121234567@hesabyar.app → 0912***4567
 *   ali@gmail.com            → a**@gmail.com
 */
export function maskLoginId(loginId: string | null | undefined): string {
  const clean = (loginId ?? "").trim();
  if (!clean) return "—";

  if (clean.toLowerCase().endsWith(SYNTHETIC_EMAIL_DOMAIN)) {
    const local = clean.slice(0, clean.indexOf("@"));
    if (/^\d{8,}$/.test(local)) {
      return `${local.slice(0, 4)}***${local.slice(-4)}`;
    }
    return local.length <= 2 ? `${local[0] ?? ""}*` : `${local[0]}***${local.slice(-1)}`;
  }

  const at = clean.indexOf("@");
  if (at <= 0) return clean.length <= 2 ? "**" : `${clean[0]}***`;

  const local = clean.slice(0, at);
  const domain = clean.slice(at);
  const head = local[0] ?? "";
  return `${head}${"*".repeat(Math.max(1, Math.min(3, local.length - 1)))}${domain}`;
}

/** پیام فارسی هر دلیل شکست. */
export const RESET_FAILURE_MESSAGES: Record<string, string> = {
  invalid: "کد بازیابی نادرست است.",
  expired: "این کد منقضی شده است. از مدیر مجموعه کد تازه بگیرید.",
  too_many: "تعداد تلاش‌ها بیش از حد مجاز بود. از مدیر مجموعه کد تازه بگیرید.",
};

/**
 * متن راهنما بر اساس نوع حساب.
 *
 * ⚠️ عمداً **نمی‌گوید** حساب وجود دارد یا نه. متن برای هر دو حالت
 * یکسان است و فقط مسیر را توضیح می‌دهد.
 */
export function recoveryHint(loginId: string): string {
  return hasRealEmail(loginId)
    ? "اگر این حساب وجود داشته باشد، لینک بازیابی به ایمیل آن فرستاده شد."
    : "این شناسه با شماره‌ی موبایل ساخته شده و ایمیل ندارد. برای بازیابی، از مدیر مجموعه کد بگیرید.";
}
