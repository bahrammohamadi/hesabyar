/**
 * ابزار بارکد — منطق خالص، بدون وابستگی به مرورگر.
 *
 * پژوهش استاندارد (خلاصه‌ی یافته‌ها):
 *
 *  • در خرده‌فروشی ایران و جهان، استاندارد غالب **EAN-13** است.
 *    پیش‌شماره‌ی ۶۲۶ متعلق به ایران است (مرکز ملی شماره‌گذاری کالا).
 *
 *  • «ایران‌کد» ۱۶ رقمی برای طبقه‌بندی و زنجیره‌ی تأمین است، نه اسکن
 *    روی صندوق فروشگاهی. روی بسته‌بندی چاپ نمی‌شود، پس اسکنر با آن
 *    کاری ندارد. (اگر کاربر دستی وارد کرد، به‌عنوان کد داخلی می‌پذیریم.)
 *
 *  • EAN-8 برای بسته‌های کوچک، UPC-A (۱۲ رقمی) برای کالای آمریکایی،
 *    و CODE-128 برای برچسب‌های داخلی فروشگاه رایج است.
 *
 *  • بارکدهای موجود در داده‌ی این پروژه ۱۲ رقمی («۹۹۰۰۰۰۰۰۰۰۰۱») و
 *    یک نمونه‌ی متنی («PANEL9B») هستند؛ یعنی کد داخلی، نه EAN واقعی.
 *    پس اعتبارسنجی نباید سخت‌گیرانه باشد و کد داخلی را رد کند.
 */

/** فرمت‌هایی که اسکنر تلاش می‌کند بخواند. */
export const SUPPORTED_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
  "codabar",
] as const;

/**
 * رقم کنترل EAN-13 / EAN-8 / UPC-A را بررسی می‌کند.
 *
 * چرا مهم است؟ اسکن نوری گاهی یک رقم را اشتباه می‌خواند. رقم کنترل
 * تقریباً همه‌ی این خطاها را می‌گیرد و جلوی افزودن کالای اشتباه به
 * فاکتور را می‌گیرد.
 *
 * الگوریتم: مجموع وزن‌دار ارقام (۱ و ۳ یک‌درمیان از راست) باید مضرب
 * ۱۰ شود.
 */
export function hasValidCheckDigit(code: string): boolean {
  if (!/^\d+$/.test(code)) return false;
  if (![8, 12, 13, 14].includes(code.length)) return false;

  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  // از راست به چپ: وزن ۳ برای موقعیت فرد، ۱ برای زوج
  const sum = digits
    .reverse()
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** آیا این کد یک EAN-13 ایرانی است؟ (پیش‌شماره ۶۲۶) */
export const isIranianEan = (code: string): boolean =>
  /^626\d{10}$/.test(code) && hasValidCheckDigit(code);

/**
 * نرمال‌سازی کد خوانده‌شده.
 *
 * سه کار انجام می‌دهد:
 *   ۱. ارقام فارسی/عربی → لاتین (کاربر ممکن است دستی تایپ کند)
 *   ۲. حذف فاصله و خط تیره که بارکدخوان‌های سخت‌افزاری گاهی می‌فرستند
 *   ۳. حذف صفرهای ابتدایی اضافه در UPC-A سیزده‌رقمی‌شده
 *
 * ⚠️ حروف حذف نمی‌شوند: کدهای داخلی مثل «PANEL9B» باید سالم بمانند.
 */
export function normalizeBarcode(raw: string | null | undefined): string {
  if (!raw) return "";
  const FA = "۰۱۲۳۴۵۶۷۸۹";
  const AR = "٠١٢٣٤٥٦٧٨٩";
  let s = String(raw)
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)))
    .replace(/[\s\-_]/g, "")
    .trim()
    .toUpperCase();

  // UPC-A دوازده‌رقمی که به‌صورت EAN-13 با صفر ابتدایی آمده
  if (/^0\d{12}$/.test(s)) s = s.slice(1);
  return s;
}

/**
 * ارزیابی کد برای نمایش به کاربر.
 *
 * عمداً «نامعتبر» برنمی‌گرداند مگر واقعاً خالی باشد؛ کد داخلی فروشگاه
 * هر شکلی می‌تواند داشته باشد. فقط وقتی کد *شبیه* EAN است ولی رقم
 * کنترلش نمی‌خواند، هشدار می‌دهیم.
 */
export type BarcodeCheck = {
  value: string;
  isEmpty: boolean;
  looksLikeEan: boolean;
  checkDigitOk: boolean;
  /** هشدار قابل نمایش، یا null اگر مشکلی نیست. */
  warning: string | null;
};

export function checkBarcode(raw: string | null | undefined): BarcodeCheck {
  const value = normalizeBarcode(raw);
  const isEmpty = value.length === 0;
  const looksLikeEan = /^\d{8}$|^\d{12,14}$/.test(value);
  const checkDigitOk = looksLikeEan ? hasValidCheckDigit(value) : true;

  let warning: string | null = null;
  if (isEmpty) warning = "کدی خوانده نشد";
  else if (looksLikeEan && !checkDigitOk)
    warning = "رقم کنترل بارکد نمی‌خواند؛ ممکن است اشتباه خوانده شده باشد";

  return { value, isEmpty, looksLikeEan, checkDigitOk, warning };
}
