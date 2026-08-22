/**
 * سری ساخت و تاریخ انقضا — منطق خالص.
 *
 * ⚠️ هیچ وابستگی به `node:` ندارد — از کامپوننت کلاینت خوانده
 * می‌شود. همان درسی که با `node:crypto` گرفتیم و فقط `next build`
 * گرفتش.
 *
 * 🔴 قاعده‌ی بنیادی: موجودی هر بچ **محاسبه** می‌شود، ذخیره نمی‌شود.
 *   جمع `stock_movements` همان بچ. اگر ستون ذخیره‌شده داشتیم، دو
 *   منبع حقیقت می‌شد که می‌توانند از هم جدا بیفتند — و در نرم‌افزار
 *   مالی هیچ‌کس نمی‌فهمد کدام درست است.
 */

/** وضعیت انقضا برای رنگ و پیام. */
export type ExpiryLevel = "expired" | "critical" | "warning" | "ok" | "none";

/**
 * آستانه‌ها به روز.
 *
 * ⚠️ چرا این اعداد؟ در سوپرمارکت لبنیات چند روزه است و کنسرو
 * چندساله؛ یک آستانه برای همه بی‌معنی است. این‌ها **پیش‌فرض**اند و
 * کاربر بازه‌ی گزارش را خودش انتخاب می‌کند.
 */
export const EXPIRY_CRITICAL_DAYS = 7;
export const EXPIRY_WARNING_DAYS = 30;

/**
 * سطح هشدار یک تاریخ انقضا.
 *
 * 🔴 `null` یعنی «تاریخ ندارد» نه «امروز منقضی می‌شود».
 *   اگر تهی را صفر می‌گرفتیم، هر کالای بدون تاریخ در گزارش انقضا
 *   قرمز می‌شد و گزارش بی‌فایده می‌گشت.
 */
export function expiryLevel(daysLeft: number | null | undefined): ExpiryLevel {
  if (daysLeft === null || daysLeft === undefined || !Number.isFinite(daysLeft)) return "none";
  if (daysLeft < 0) return "expired";
  if (daysLeft <= EXPIRY_CRITICAL_DAYS) return "critical";
  if (daysLeft <= EXPIRY_WARNING_DAYS) return "warning";
  return "ok";
}

/** برچسب و لحن رنگی هر سطح. */
export const EXPIRY_META: Record<ExpiryLevel, { label: string; tone: "danger" | "warning" | "success" | "neutral" }> = {
  expired: { label: "منقضی شده", tone: "danger" },
  critical: { label: "بحرانی", tone: "danger" },
  warning: { label: "نزدیک انقضا", tone: "warning" },
  ok: { label: "سالم", tone: "success" },
  none: { label: "بدون تاریخ", tone: "neutral" },
};

/**
 * متن روزهای باقی‌مانده.
 *
 * ⚠️ ارقام فارسی اینجا اعمال **نمی‌شود** — این تابع خالص است و
 * تبدیل رقم کار لایه‌ی نمایش است.
 */
export function daysLeftText(daysLeft: number | null | undefined): string {
  if (daysLeft === null || daysLeft === undefined || !Number.isFinite(daysLeft)) return "—";
  if (daysLeft < 0) return `${Math.abs(daysLeft)} روز گذشته`;
  if (daysLeft === 0) return "امروز";
  return `${daysLeft} روز`;
}

/**
 * برچسب نمایشی یک بچ.
 *
 * 🔴 دو توکن جدا برمی‌گرداند نه یک رشته.
 *   رشته‌ی `${سری} · ${تاریخ}` در متن راست‌به‌چپ بازچینش می‌شود و
 *   اعداد به هم می‌چسبند. این خانواده‌باگ چند بار تکرار شده، پس
 *   خود تابع هم اجازه‌ی ساختنش را نمی‌دهد.
 */
export function batchTokens(batch: {
  lot_no?: string | null;
  expiry_date?: string | null;
}): string[] {
  const out: string[] = [];
  const lot = (batch.lot_no ?? "").trim();
  if (lot) out.push(`سری ${lot}`);
  if (batch.expiry_date) out.push(batch.expiry_date);
  return out;
}

/**
 * آیا این ورودی برای ساخت بچ کافی است؟
 *
 * حداقل یکی از سری یا تاریخ لازم است — بچ بدون هویت قابل استفاده
 * نیست. همان محدودیت `batch_needs_identity` در دیتابیس.
 */
export function canCreateBatch(input: { lotNo?: string | null; expiry?: string | null }): boolean {
  const lot = (input.lotNo ?? "").trim();
  const exp = (input.expiry ?? "").trim();
  return Boolean(lot || exp);
}

/**
 * مرتب‌سازی بچ‌ها برای مصرف — قدیمی‌ترین انقضا اول (FEFO).
 *
 * 🔴 چرا FEFO و نه FIFO؟
 *   در کالای تاریخ‌دار، «اولین ورودی» مهم نیست؛ «اولین انقضا» مهم
 *   است. بچی که دیرتر خریده شده ولی زودتر منقضی می‌شود باید اول
 *   فروخته شود، وگرنه روی دست می‌ماند.
 *
 * ⚠️ بچ بدون تاریخ **آخر** می‌آید، نه اول: نبود تاریخ یعنی فوریتی
 *   ندارد.
 */
export function sortForConsumption<T extends { expiry_date?: string | null; qty?: number }>(
  batches: T[]
): T[] {
  return [...batches].sort((a, b) => {
    const ax = a.expiry_date ?? "";
    const bx = b.expiry_date ?? "";
    if (!ax && !bx) return 0;
    if (!ax) return 1;
    if (!bx) return -1;
    return ax < bx ? -1 : ax > bx ? 1 : 0;
  });
}

/**
 * خلاصه‌ی وضعیت برای نمایش بالای گزارش.
 *
 * فقط بچ‌هایی که موجودی دارند شمرده می‌شوند — بچ تمام‌شده‌ی منقضی
 * هیچ اهمیتی ندارد و فقط عدد را بی‌معنا بزرگ می‌کند.
 */
export function summarizeExpiry(
  rows: Array<{ days_left?: number | null; qty?: number | null }>
) {
  let expired = 0;
  let critical = 0;
  let warning = 0;

  for (const r of rows) {
    if ((r.qty ?? 0) <= 0) continue;
    const level = expiryLevel(r.days_left);
    if (level === "expired") expired++;
    else if (level === "critical") critical++;
    else if (level === "warning") warning++;
  }

  return { expired, critical, warning, total: expired + critical + warning };
}
