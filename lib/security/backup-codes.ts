import { createHash, randomInt } from "node:crypto";
import { BACKUP_CODE_COUNT } from "./mfa";

/**
 * کدهای پشتیبان ورود دومرحله‌ای — بخش سروری.
 *
 * ⚠️ این فایل `node:crypto` دارد و **هرگز نباید** از کامپوننت
 * کلاینت import شود. همان درسی که با `recovery.ts` گرفتیم.
 *
 * استاندارد NIST SP 800-63B §4.2.1.1 (Saved Recovery Codes):
 *   • SHALL هش‌شده با تابع یک‌طرفه‌ی تأییدشده ذخیره شوند
 *   • SHALL فقط یک بار قابل استفاده باشند
 *   • SHALL مشمول محدودیت نرخ باشند
 */

/**
 * الفبای کد.
 *
 * 🔴 حروف و ارقام مبهم عمداً حذف شده‌اند: `0/O`، `1/I/l`، `5/S`،
 * `2/Z`، `8/B`. کاربر این کد را از روی **کاغذ** می‌خواند و تایپ
 * می‌کند؛ یک اشتباه خواندن یعنی سوختن یکی از پنج تلاش، و در
 * بدترین حالت قفل‌شدن حسابی که اصلاً همین کد قرار بود نجاتش دهد.
 */
const ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";

/** طول هر کد؛ ۱۰ نویسه از الفبای ۲۵تایی ≈ ۴۶ بیت آنتروپی. */
const CODE_LENGTH = 10;

/**
 * تولید یک مجموعه کد تازه.
 *
 * ⚠️ `randomInt` و نه `Math.random()`: دومی از نظر رمزنگاری قابل
 * پیش‌بینی است و این کدها لایه‌ی آخر دفاع حساب‌اند.
 */
export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  const codes: string[] = [];
  const seen = new Set<string>();

  while (codes.length < count) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += ALPHABET[randomInt(0, ALPHABET.length)];
    }
    // احتمالش ناچیز است ولی کد تکراری یعنی یک کد کمتر از آنچه
    // به کاربر وعده داده‌ایم.
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes;
}

/**
 * هش کد پشتیبان.
 *
 * ⚠️ `userId` بخشی از ورودی هش است — یعنی نمک per-user.
 *   NIST می‌گوید کدهای با آنتروپی کمتر از ۱۱۲ بیت باید نمک‌دار
 *   باشند. بدون آن، دو کاربر با کد یکسان هش یکسان می‌گرفتند و یک
 *   جدول رنگین‌کمانی همه را با هم می‌شکست.
 */
export function hashBackupCode(code: string, userId: string, pepper: string): string {
  return createHash("sha256")
    .update(`${pepper}:${userId}:${normalizeBackupCode(code)}`)
    .digest("hex");
}

/**
 * نرمال‌سازی ورودی کاربر.
 *
 * 🔴 کاربر کد را از کاغذ می‌خواند. ممکن است با فاصله، خط تیره یا
 * حروف کوچک بنویسد. رد کردن این‌ها یعنی مجازات کردن کاربری که کد
 * **درست** را وارد کرده.
 */
export function normalizeBackupCode(input: string): string {
  return (input ?? "").toUpperCase().replace(/[\s-]/g, "");
}

/** آیا کد از نظر شکلی معتبر است؟ پیش از تماس با دیتابیس. */
export function isWellFormedBackupCode(input: string): boolean {
  const clean = normalizeBackupCode(input);
  if (clean.length !== CODE_LENGTH) return false;
  return [...clean].every((c) => ALPHABET.includes(c));
}

/**
 * قالب‌بندی برای نمایش: `ACDE-FGHJ-KM`.
 *
 * خواندن و رونویسی گروه‌های چهارتایی از کاغذ بسیار کم‌خطاتر از یک
 * رشته‌ی ۱۰ نویسه‌ای پیوسته است.
 */
export function formatBackupCode(code: string): string {
  const clean = normalizeBackupCode(code);
  return clean.replace(/(.{4})/g, "$1-").replace(/-$/, "");
}
