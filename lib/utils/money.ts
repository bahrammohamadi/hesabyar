/**
 * نمایش و ورودی مبالغ با واحد قابل انتخاب.
 *
 * 🔴 قاعده‌ای که هرگز نمی‌شکند:
 *   **دیتابیس همیشه ریال است.**
 *
 *   `formatToman` قدیمی همیشه بر ۱۰ تقسیم می‌کرد و کلمه‌ی «تومان»
 *   را می‌چسباند. برای سازمانی که ریالی کار می‌کند، این یعنی هر
 *   عدد روی صفحه یک‌دهم واقعیت است — و کاربر هیچ راهی برای فهمیدنش
 *   ندارد چون برچسب هم می‌گوید «تومان».
 *
 * ⚠️ چرا `formatToman` حذف نشد؟
 *   در ۱۲۷ نقطه استفاده شده. حذف یک‌باره یعنی ۱۲۷ نقطه‌ی شکست
 *   بالقوه در یک کامیت. به‌جایش این ماژول کنارش می‌نشیند، رفتار
 *   پیش‌فرضش **دقیقاً** مثل قبل است (تومان)، و نقاط به‌تدریج
 *   مهاجرت می‌کنند.
 */

import { toFaDigits } from "./format";
import { CURRENCIES, DEFAULT_CURRENCY, type CurrencyCode } from "../org-prefs";

/**
 * تبدیل ریالِ ذخیره‌شده به عدد واحد نمایش.
 *
 * ⚠️ گرد کردن صریح لازم است: `1234567 / 10` در جاوااسکریپت
 * `123456.7` می‌دهد و نمایشش اعشار بی‌معنی دارد.
 */
export function rialToDisplay(rial: number | null | undefined, currency: CurrencyCode = DEFAULT_CURRENCY): number {
  const v = rial ?? 0;
  return Math.round(v / CURRENCIES[currency].divisor);
}

/**
 * تبدیل عدد واردشده‌ی کاربر به ریال برای ذخیره.
 *
 * 🔴 این تابع قرینه‌ی دقیق `rialToDisplay` است. اگر از هم جدا
 * بیفتند، مبلغی که کاربر می‌بیند با آنچه ذخیره می‌شود فرق می‌کند —
 * و چون هر دو «درست به‌نظر می‌رسند»، کسی متوجه نمی‌شود.
 */
export function displayToRial(value: number | null | undefined, currency: CurrencyCode = DEFAULT_CURRENCY): number {
  const v = value ?? 0;
  return Math.round(v * CURRENCIES[currency].divisor);
}

/**
 * قالب‌بندی مبلغ با واحد انتخابی سازمان.
 *
 * @param rial مبلغ خام از دیتابیس (همیشه ریال)
 * @param currency واحد نمایش سازمان
 * @param withLabel برچسب واحد چسبانده شود؟
 */
export function formatMoney(
  rial: number | null | undefined,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  withLabel = true
): string {
  const value = rialToDisplay(rial, currency);
  const formatted = toFaDigits(value.toLocaleString("en-US"));
  return withLabel ? `${formatted} ${CURRENCIES[currency].short}` : formatted;
}

/** فقط برچسب واحد — برای کنار کادرهای ورودی. */
export function currencyLabel(currency: CurrencyCode = DEFAULT_CURRENCY): string {
  return CURRENCIES[currency].short;
}

/**
 * متن راهنمای فیلد مبلغ، مثل «قیمت فروش (تومان)».
 *
 * 🔴 چرا تابع و نه رشته‌ی ثابت؟ در ۴۰ جا این الگو سخت‌کد شده بود.
 * وقتی سازمان ریالی می‌شود، آن برچسب‌ها همچنان «تومان» می‌گویند و
 * کاربر عدد را ده برابر وارد می‌کند.
 */
export function moneyFieldLabel(base: string, currency: CurrencyCode = DEFAULT_CURRENCY): string {
  return `${base} (${CURRENCIES[currency].short})`;
}

/**
 * ⚠️ هشدار تغییر واحد.
 *
 * وقتی کاربر واحد را عوض می‌کند، همه‌ی اعداد روی صفحه ده برابر یا
 * یک‌دهم می‌شوند. بدون توضیح صریح، این شبیه یک باگ فاجعه‌بار
 * به‌نظر می‌رسد و کاربر فکر می‌کند داده‌اش خراب شده.
 */
export const CURRENCY_SWITCH_NOTE =
  "تغییر واحد فقط روی نمایش اثر دارد. مبالغ ثبت‌شده دست نمی‌خورند؛ فقط شکل نوشتنشان عوض می‌شود. مثلاً ۱۰۰٬۰۰۰ ریال همان ۱۰٬۰۰۰ تومان است.";
