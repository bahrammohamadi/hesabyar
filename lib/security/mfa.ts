/**
 * ورود دومرحله‌ای (TOTP) — منطق خالص.
 *
 * ⚠️ هیچ وابستگی به `node:` ندارد؛ از کامپوننت کلاینت خوانده می‌شود.
 * همان درسی که با `node:crypto` گرفتیم.
 *
 * چرا TOTP و نه پیامک؟
 *   • پیامک هزینه‌ی جاری دارد و سرویسش وصل نیست
 *   • SIM swap یک حمله‌ی واقعی است؛ NIST از ۲۰۱۶ پیامک را توصیه نمی‌کند
 *   • TOTP آفلاین کار می‌کند — مهم برای فروشنده‌ای با اینترنت ضعیف
 *
 * ✅ سنجیده شد که روی همین پروژه در پلن رایگان کار می‌کند:
 *    POST /auth/v1/factors → QR و secret برگرداند.
 */

/** طول کد یک‌بارمصرف اپ احرازکننده. */
export const TOTP_CODE_LENGTH = 6;

/** تعداد کدهای پشتیبان که هنگام فعال‌سازی ساخته می‌شود. */
export const BACKUP_CODE_COUNT = 10;

/**
 * ارقام فارسی و عربی را به لاتین تبدیل و جداکننده‌ها را حذف می‌کند.
 *
 * 🔴 بدون این، کاربری که با کیبورد فارسی «۱۲۳۴۵۶» تایپ می‌کند کد
 * **درست** را وارد کرده ولی «کد اشتباه» می‌گیرد. چون کد TOTP هر
 * ۳۰ ثانیه عوض می‌شود، او فکر می‌کند ساعت گوشی‌اش خراب است و
 * ممکن است کلاً از حسابش قفل شود.
 *
 * ⚠️ فاصله هم حذف می‌شود: بعضی اپ‌ها کد را «۱۲۳ ۴۵۶» نشان می‌دهند
 * و کاربر عیناً کپی می‌کند.
 */
export function normalizeTotpInput(input: string): string {
  return (input ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[\s-]/g, "");
}

/** آیا کد از نظر شکلی معتبر است؟ پیش از تماس با سرور بررسی می‌شود. */
export function isWellFormedTotp(input: string): boolean {
  return new RegExp(`^\\d{${TOTP_CODE_LENGTH}}$`).test(normalizeTotpInput(input));
}

/**
 * وضعیت دومرحله‌ای کاربر، از فهرست فاکتورهای Supabase.
 *
 * ⚠️ فاکتور `unverified` یعنی کاربر QR را دیده ولی تأیید نکرده —
 * یعنی دومرحله‌ای **فعال نیست**. اگر آن را «فعال» حساب می‌کردیم،
 * کاربری که وسط راه پنجره را بست فکر می‌کرد محافظت دارد در حالی
 * که ندارد.
 */
export type MfaFactor = { id: string; status: string; friendly_name?: string | null };

export function mfaState(factors: MfaFactor[] | null | undefined) {
  const list = factors ?? [];
  const verified = list.filter((f) => f.status === "verified");
  const pending = list.filter((f) => f.status !== "verified");
  return {
    enabled: verified.length > 0,
    verifiedIds: verified.map((f) => f.id),
    /* فاکتورهای نیمه‌کاره باید پاک شوند تا انبار نشوند. */
    staleIds: pending.map((f) => f.id),
  };
}

/**
 * پیام فارسی خطاهای Supabase.
 *
 * 🔴 چرا لازم است: پیام خام انگلیسی («Invalid TOTP code entered»)
 * برای مغازه‌داری که فارسی می‌خواند بی‌معنی است و باعث می‌شود فکر
 * کند برنامه خراب شده، نه اینکه کدش اشتباه است.
 */
export function mfaErrorMessage(raw: string | null | undefined): string {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("invalid totp") || s.includes("invalid code")) {
    return "کد واردشده درست نیست. کد فعلی اپ را دوباره ببینید.";
  }
  if (s.includes("expired")) {
    return "این کد منقضی شده است. کد تازه‌ی اپ را وارد کنید.";
  }
  if (s.includes("rate") || s.includes("too many")) {
    return "تلاش‌های بیش از حد. چند لحظه صبر کنید.";
  }
  if (s.includes("already") && s.includes("enroll")) {
    return "برای این حساب از قبل ورود دومرحله‌ای فعال است.";
  }
  return raw ? "انجام نشد. دوباره تلاش کنید." : "خطای ناشناخته.";
}

/**
 * راهنمای اختلاف ساعت.
 *
 * 🔴 شایع‌ترین علت «کد کار نمی‌کند» ساعت اشتباه گوشی است، نه کد
 * اشتباه. TOTP بر پایه‌ی زمان کار می‌کند و اگر ساعت گوشی چند دقیقه
 * جلو یا عقب باشد هیچ کدی قبول نمی‌شود. بدون این راهنما، کاربر
 * بارها تلاش می‌کند و آخرش فکر می‌کند برنامه خراب است.
 */
export const CLOCK_HINT =
  "اگر کدها قبول نمی‌شوند، ساعت گوشی را روی «تنظیم خودکار» بگذارید. کد یک‌بارمصرف بر پایه‌ی زمان ساخته می‌شود و اختلاف چند دقیقه‌ای باعث رد شدن آن می‌شود.";
