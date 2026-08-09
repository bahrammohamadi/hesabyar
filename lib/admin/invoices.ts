/**
 * کمکی‌های مشترک فاکتورهای پنل سوپرادمین.
 *
 * چرا در فایل جدا و نه داخل route.ts؟
 *   دو دلیل. اول اینکه صفحه و روت هر دو به همین ثابت‌ها نیاز دارند و
 *   نسخه‌ی دوتایی یعنی روزی یکی عوض می‌شود و دیگری نه.
 *
 *   دوم و مهم‌تر: فایل route.ts فقط اجازه‌ی export نام‌های شناخته‌شده
 *   دارد (GET/POST/dynamic/maxDuration/runtime). هر export دیگری
 *   `next build` را با «"X" is not a valid Route export field»
 *   می‌شکند — در حالی که tsc کاملاً تمیز رد می‌شود. این تله دو بار
 *   قبلاً ما را گرفته (mapTicket و fileResponse).
 */

/** وضعیت‌های مجاز فاکتور فروش — باید با قید sales_status_document_compat_check یکی باشد. */
export const INVOICE_STATUSES = [
  "draft",
  "confirmed",
  "paid",
  "settled",
  "reversed",
  "cancelled",
  "returned",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "پیش‌نویس",
  confirmed: "تأییدشده",
  paid: "پرداخت‌شده",
  settled: "تسویه‌شده",
  reversed: "برگشت‌خورده",
  cancelled: "باطل‌شده",
  returned: "مرجوعی",
};

/**
 * حداقل طول دلیل برای عملیات ادمین روی سند مالی مشتری.
 *
 * وقتی کسی بیرون از کسب‌وکار سند مالی را دست‌کاری می‌کند، «چرا»
 * بخشی از خود عمل است نه یادداشت اختیاری. همان قاعده‌ای که برای
 * بازنشانی رمز عبور گذاشتیم.
 *
 * ⚠️ این عدد باید با گارد داخل تابع admin_cancel_sale یکی بماند؛
 * اعتبارسنجی سمت سرور و دیتابیس هر دو لازم‌اند: اولی پیام بهتری
 * می‌دهد، دومی حتی اگر روت دور زده شود نگه می‌دارد.
 */
export const MIN_REASON_LENGTH = 5;

/** آیا دلیل واردشده برای عملیات حساس کافی است؟ */
export function isReasonValid(reason: unknown): boolean {
  return typeof reason === "string" && reason.trim().length >= MIN_REASON_LENGTH;
}
