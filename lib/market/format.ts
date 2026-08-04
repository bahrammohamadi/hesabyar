/**
 * قالب‌بندی اعداد نوار بازار.
 *
 * ⚠️ چرا از formatToman موجود استفاده نشد؟
 * آن تابع ورودی را **ریال** فرض می‌کند و بر ۱۰ تقسیم می‌کند. مقادیر
 * اینجا از قبل تومانی‌اند (تبدیل در providers انجام شده)، پس استفاده
 * از آن قیمت دلار را ۱۹٬۲۸۸ نشان می‌داد به‌جای ۱۹۲٬۸۸۰.
 */

import { toFaDigits } from "@/lib/utils/format";

/**
 * عدد تومانی با جداکننده‌ی هزارگان فارسی.
 *
 * برای اعداد بزرگ (سکه = ۱۸۴٬۹۹۵٬۰۰۰) خلاصه‌سازی انجام می‌شود چون
 * در نوار باریک هدر جا نمی‌شود:
 *   ≥ ۱ میلیون → «۱۸۴.۹ م»
 * زیر آن، عدد کامل نمایش داده می‌شود تا دقت قیمت دلار حفظ شود.
 */
export function formatQuoteValue(value: number, unit: "toman" | "usd", compact: boolean): string {
  if (unit === "usd") {
    /*
      ارز دیجیتال و انس دلاری‌اند. بیت‌کوین ۶۳٬۶۸۵ است و تتر ۱.۰۰ —
      پس تعداد اعشار باید به بزرگی عدد بستگی داشته باشد، وگرنه یا
      تتر «۱» می‌شود یا بیت‌کوین «۶۳۶۸۵.۰۷۰۰».
    */
    const decimals = value >= 1000 ? 0 : value >= 1 ? 2 : 4;
    return toFaDigits(value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  }

  if (compact && value >= 1_000_000) {
    const millions = value / 1_000_000;
    // یک رقم اعشار کافی است: «۱۸۴.۹ م»
    return `${toFaDigits(millions.toFixed(1))} م`;
  }

  return toFaDigits(Math.round(value).toLocaleString("en-US"));
}

/** واحد نمایشی کنار عدد. */
export function unitLabel(unit: "toman" | "usd"): string {
  return unit === "usd" ? "دلار" : "تومان";
}

/**
 * درصد تغییر با علامت و رقم فارسی.
 * صفر بدون علامت نمایش داده می‌شود.
 */
export function formatChange(percent: number): string {
  if (percent === 0) return "۰٪";
  const sign = percent > 0 ? "+" : "−";
  return `${sign}${toFaDigits(Math.abs(percent).toFixed(2))}٪`;
}

/**
 * دما با رقم فارسی.
 *
 * ⚠️ برای منفی از «−» (U+2212) استفاده می‌شود نه خط تیره‌ی ASCII.
 * تست این ناسازگاری را گرفت: formatChange از منهای یونیکد استفاده
 * می‌کرد و دما از «-»، یعنی دو علامت متفاوت کنار هم در یک نوار.
 * منهای یونیکد در RTL هم درست‌تر رندر می‌شود.
 */
export function formatTemp(celsius: number): string {
  const sign = celsius < 0 ? "−" : "";
  return `${sign}${toFaDigits(Math.abs(celsius))}°`;
}
