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

/** آیا اصلاً فیلتری فعال است؟ */
export function hasRange(range: DateRange): boolean {
  return Boolean(range.from || range.to);
}

/** روز بعدِ یک تاریخ میلادی `YYYY-MM-DD` — بدون وابستگی به dayjs. */
export function nextDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  // Date.UTC خودش سرریز ماه/سال را درست می‌کند (۳۱ اسفند → اول فروردین).
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * کران‌های فیلتر سمت سرور.
 *
 * 🔴 چرا `lt(روز بعد)` و نه `lte(to)`؟
 *   بعضی ستون‌ها `date` خالص‌اند (`sales.date`) و بعضی timestamptz
 *   (`stock_movements.created_at`, `activity_logs.created_at`).
 *   روی timestamptz، `lte('2026-08-03')` یعنی «کوچک‌تر یا مساوی
 *   ۲۰۲۶-۰۸-۰۳ ساعت ۰۰:۰۰» و هر رکوردی که همان روز ساعت ۹ صبح ثبت
 *   شده بیرون می‌افتد. کاربر «امروز» را انتخاب می‌کند و لیست خالی
 *   می‌بیند در حالی که همین الان چیزی ثبت کرده.
 *
 *   `lt(روز بعد)` روی هر دو نوع ستون درست کار می‌کند.
 */
export function rangeBounds(range: DateRange): { gte?: string; lt?: string } {
  const out: { gte?: string; lt?: string } = {};
  if (range.from) out.gte = range.from;
  if (range.to) out.lt = nextDay(range.to);
  return out;
}

/**
 * اعمال بازه روی یک کوئری Supabase.
 *
 * تایپ ژنریک نگه داشته شده تا زنجیره‌ی کوئری (`.order`, `.limit`)
 * بعد از آن هم قابل ادامه باشد.
 */
export function applyRange<T extends { gte: (c: string, v: string) => T; lt: (c: string, v: string) => T }>(
  query: T,
  column: string,
  range: DateRange
): T {
  const { gte, lt } = rangeBounds(range);
  let q = query;
  if (gte) q = q.gte(column, gte);
  if (lt) q = q.lt(column, lt);
  return q;
}
