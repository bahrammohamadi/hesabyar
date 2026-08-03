/**
 * توابع خالص فیلتر بازه‌ی تاریخ — بدون JSX.
 *
 * جدا از DateRangeFilter.tsx نگه داشته شده تا تست واحد بدون نیاز به
 * پردازش JSX بتواند import کند (همان الگوی chart-utils).
 */

export type DateRange = { from: string; to: string };

export const EMPTY_RANGE: DateRange = { from: "", to: "" };

/**
 * آیا تاریخ داخل بازه است؟
 *
 * ⚠️ مقایسه روی ۱۰ نویسه‌ی اول انجام می‌شود چون ستون تاریخ گاهی
 * timestamp کامل است («2026-08-31T14:22:00Z») و مقایسه‌ی رشته‌ای
 * کامل، رکوردهای همان روزِ پایانی را از قلم می‌انداخت.
 */
export function withinRange(dateValue: string | null | undefined, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  if (!dateValue) return false;
  const d = String(dateValue).slice(0, 10);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}
