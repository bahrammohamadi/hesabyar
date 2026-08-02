/**
 * توابع خالص نمودار — بدون JSX.
 *
 * جدا از ChartKit.tsx نگه داشته شده‌اند تا در تست واحد بدون نیاز به
 * پردازش JSX قابل import باشند.
 */

import { toFaDigits } from "@/lib/utils/format";

/**
 * کوتاه‌کردن عدد محور Y با پسوند فارسی.
 * «۱٫۲ م» به‌جای «1200000» — محور باریک می‌ماند و خوانا.
 */
export function compactAxisNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return toFaDigits((value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")) + " میلیارد";
  if (abs >= 1_000_000) return toFaDigits((value / 1_000_000).toFixed(1).replace(/\.0$/, "")) + " م";
  if (abs >= 1_000) return toFaDigits(Math.round(value / 1_000)) + " هـ";
  return toFaDigits(value);
}

/**
 * تعداد تیک محور X بر اساس عرض.
 *
 * روی موبایل با ۳۰ نقطه، برچسب‌ها روی هم می‌افتند و Recharts بعضی را
 * بی‌قاعده حذف می‌کند. با interval صریح، فاصله‌ها منظم می‌ماند.
 */
export function tickInterval(pointCount: number, isMobile: boolean): number {
  const maxTicks = isMobile ? 4 : 8;
  if (pointCount <= maxTicks) return 0;
  return Math.ceil(pointCount / maxTicks) - 1;
}
