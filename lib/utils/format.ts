import dayjs from "dayjs";
import jalaliday from "jalaliday";

dayjs.extend(jalaliday);

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

/** تاریخ شمسی از یک تاریخ میلادی/ISO */
export function toJalali(date: string | Date | null | undefined, withTime = false): string {
  if (!date) return "-";
  const d = dayjs(date).calendar("jalali");
  const fmt = withTime ? "YYYY/MM/DD HH:mm" : "YYYY/MM/DD";
  return toFaDigits(d.format(fmt));
}

/** تاریخ شمسی امروز به صورت رشته */
export function todayJalali(): string {
  return toFaDigits(dayjs().calendar("jalali").format("YYYY/MM/DD"));
}

/** نام روز و تاریخ کامل شمسی (برای هدر) */
export function fullJalali(date?: string | Date): string {
  const days = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
  const months = [
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
  ];
  const d = dayjs(date ?? new Date()).calendar("jalali");
  const dayName = days[dayjs(date ?? new Date()).day()];
  const day = toFaDigits(d.format("D"));
  const month = months[d.month()];
  const year = toFaDigits(d.format("YYYY"));
  return `${dayName} ${day} ${month} ${year}`;
}
