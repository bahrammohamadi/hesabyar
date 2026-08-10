"use client";

import { buildCsv, safeFilename } from "./csv";

/**
 * دانلود فایل در مرورگر.
 *
 * جدا از `csv.ts` است چون به `document` و `URL` نیاز دارد و آن فایل
 * باید در محیط سرور و در Vitest بدون DOM هم قابل import باشد.
 */

/**
 * 🔴 نشت حافظه در نسخه‌ی قبلی.
 *
 * کد قبلی بلافاصله بعد از `a.click()` این را صدا می‌زد:
 *     URL.revokeObjectURL(url);
 *
 * در فایرفاکس و سافاری، دانلود هنوز شروع نشده که آدرس باطل می‌شود و
 * فایل خالی یا ناقص ذخیره می‌شود. در کروم معمولاً کار می‌کند، برای
 * همین کسی متوجه نشده بود.
 *
 * با تأخیر کوتاه، هم دانلود فرصت شروع پیدا می‌کند و هم حافظه آزاد
 * می‌شود (بدون revoke، هر خروجی تا بسته‌شدن تب در حافظه می‌ماند).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename(filename);
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * دانلود CSV از ردیف‌های داده.
 *
 * برمی‌گرداند: false اگر داده‌ای نبود.
 *
 * ⚠️ نسخه‌ی قبلی در این حالت `alert()` می‌زد — پنجره‌ی سیستمی
 * انگلیسی وسط رابط فارسی. حالا فراخوان تصمیم می‌گیرد چه پیامی
 * (معمولاً toast) نشان بدهد.
 */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]): boolean {
  if (rows.length === 0) return false;
  const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, filename);
  return true;
}
