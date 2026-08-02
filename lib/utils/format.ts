import dayjs from "dayjs";
import jalaliday from "jalaliday";

// jalaliday باید دقیقاً یک‌بار و ایمن extend شود. در production build اگر
// این کار دوباره یا ناهماهنگ انجام شود، calendar("jalali") می‌تواند خطا بدهد.
const globalForDayjs = globalThis as typeof globalThis & { __jalalidayExtended__?: boolean };
if (!globalForDayjs.__jalalidayExtended__) {
  try {
    dayjs.extend(jalaliday);
  } catch {
    // در صورت شکست extend، توابع تاریخ به fallback میلادی برمی‌گردند.
  }
  globalForDayjs.__jalalidayExtended__ = true;
}

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** تبدیل ارقام انگلیسی به فارسی */
export function toFaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** تبدیل ارقام فارسی/عربی به انگلیسی (برای ورودی‌ها) */
export function toEnDigits(input: string): string {
  if (!input) return "";
  return input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** نرمال‌سازی متن جستجو: اعداد فارسی/عربی و انگلیسی یکسان دیده شوند. */
export function normalizeSearchText(input: string | number | null | undefined): string {
  return toEnDigits(String(input ?? "")).trim().toLowerCase();
}

/**
 * نمایش مبلغ. در دیتابیس مبالغ به ریال ذخیره می‌شوند.
 * این تابع ریال را به تومان تبدیل و با جداکننده هزارگان فارسی نمایش می‌دهد.
 */
export function formatToman(rial: number | null | undefined, withLabel = true): string {
  const value = Math.round((rial ?? 0) / 10);
  const formatted = toFaDigits(value.toLocaleString("en-US"));
  return withLabel ? `${formatted} تومان` : formatted;
}

/** تبدیل تومان (ورودی کاربر) به ریال (ذخیره در دیتابیس) */
export function tomanToRial(toman: number): number {
  return Math.round(toman * 10);
}

/** تبدیل ریال به تومان (عدد خام، بدون فرمت) */
export function rialToToman(rial: number): number {
  return Math.round(rial / 10);
}

/** عدد با جداکننده هزارگان فارسی (بدون واحد) */
export function formatNumber(n: number | null | undefined): string {
  return toFaDigits((n ?? 0).toLocaleString("en-US"));
}

/** تبدیل ایمن یک تاریخ به dayjs شمسی. در صورت خطا null برمی‌گرداند. */
function toJalaliDayjs(date: dayjs.ConfigType) {
  try {
    const base = dayjs(date);
    if (!base.isValid()) return null;
    // calendar فقط وقتی وجود دارد که plugin درست extend شده باشد.
    const cal = (base as unknown as { calendar?: (c: string) => dayjs.Dayjs }).calendar;
    if (typeof cal !== "function") return null;
    return base.calendar("jalali");
  } catch {
    return null;
  }
}

/** تاریخ شمسی از یک تاریخ میلادی/ISO */
export function toJalali(date: string | Date | null | undefined, withTime = false): string {
  if (!date) return "-";
  const fmt = withTime ? "YYYY/MM/DD HH:mm" : "YYYY/MM/DD";
  const j = toJalaliDayjs(date);
  if (j) return toFaDigits(j.format(fmt));
  // fallback میلادی در صورت عدم دسترسی به تقویم شمسی
  const g = dayjs(date);
  return g.isValid() ? toFaDigits(g.format(fmt)) : "-";
}

/** تاریخ شمسی امروز به صورت رشته */
export function todayJalali(): string {
  const j = toJalaliDayjs(new Date());
  if (j) return toFaDigits(j.format("YYYY/MM/DD"));
  return toFaDigits(dayjs().format("YYYY/MM/DD"));
}

/** نام روز و تاریخ کامل شمسی (برای هدر) */
export function fullJalali(date?: string | Date): string {
  const days = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
  const months = [
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
  ];
  const source = dayjs(date ?? new Date());
  if (!source.isValid()) return "";

  const j = toJalaliDayjs(source);
  if (!j) {
    // fallback: حداقل تاریخ میلادی را بده تا برنامه crash نکند.
    return toFaDigits(source.format("YYYY/MM/DD"));
  }

  const dayName = days[source.day()] ?? "";
  const day = toFaDigits(j.format("D"));
  const monthIndex = j.month();
  const month = months[monthIndex] ?? "";
  const year = toFaDigits(j.format("YYYY"));
  return `${dayName} ${day} ${month} ${year}`.trim();
}

/**
 * نمایش نام کاربری بدون دامنه‌ی داخلی.
 *
 * ثبت‌نام با شماره موبایل یا نام کاربری انجام می‌شود و سیستم پشت صحنه
 * `@hesabyar.app` به آن اضافه می‌کند تا Supabase Auth که ایمیل می‌خواهد
 * راضی شود. این دامنه یک جزئیات فنی است و نباید به کاربر نشان داده شود.
 *
 * ایمیل‌های واقعی (مثل info@example.com) دست‌نخورده باقی می‌مانند.
 */
export function displayUsername(email: string | null | undefined): string {
  if (!email) return "";
  return email.endsWith("@hesabyar.app") ? email.slice(0, -"@hesabyar.app".length) : email;
}

/**
 * نرمال‌سازی و اعتبارسنجی شماره موبایل ایران.
 *
 * ورودی کاربر ممکن است هر کدام از این‌ها باشد:
 *   ۰۹۱۲۳۴۵۶۷۸۹ · 0912 345 6789 · +989123456789 · 989123456789 · 9123456789
 *
 * خروجی همیشه شکل یکدست ۰۹xxxxxxxxx با ارقام لاتین است، یا null اگر
 * شماره معتبر نباشد. ذخیره‌ی یکدست لازم است وگرنه جستجو و
 * یکتایی شماره بعداً می‌شکند.
 */
export function normalizeIranMobile(input: string | null | undefined): string | null {
  if (!input) return null;

  // ارقام فارسی/عربی → لاتین، سپس حذف هر چیز غیر رقم (فاصله، خط تیره، پرانتز)
  let s = toEnDigits(String(input)).replace(/\D/g, "");

  // پیش‌شماره‌ی بین‌المللی: +98 و 0098 هر دو به 0 تبدیل می‌شوند
  if (s.startsWith("0098")) s = s.slice(4);
  else if (s.startsWith("98") && s.length === 12) s = s.slice(2);

  // کاربرانی که صفر ابتدایی را نمی‌نویسند
  if (s.length === 10 && s.startsWith("9")) s = "0" + s;

  return /^09\d{9}$/.test(s) ? s : null;
}

/** true اگر شماره موبایل ایران معتبر باشد. */
export const isValidIranMobile = (input: string | null | undefined): boolean =>
  normalizeIranMobile(input) !== null;
