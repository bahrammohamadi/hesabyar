/**
 * منطق خالصِ «فهرست قابل مدیریت» (دسته‌بندی، برند، دسته‌ی هزینه).
 *
 * چرا در فایل `.ts` جدا و نه داخل کامپوننت `.tsx`؟
 *   Vitest نمی‌تواند JSX را از فایل `.tsx` بخواند، پس هر منطقی که
 *   می‌خواهیم واقعاً تست شود باید در `.ts` خالص باشد. این درسِ
 *   چند نوبت قبل است.
 */

/** جدول‌هایی که کارت «فهرست قابل مدیریت» پشتیبانی می‌کند. */
export const MANAGED_TABLES = ["categories", "brands", "expense_categories"] as const;

export type ManagedTable = (typeof MANAGED_TABLES)[number];

/**
 * 🔴 آیا این جدول ستون `branch_id` دارد؟
 *
 * باگی که این نگاشت می‌بندد (اندازه‌گیری روی دیتابیس زنده):
 *   جدول `categories` تا پیش از مهاجرت ۰۰۴۰ نه `org_id` داشت نه
 *   `is_active` نه `branch_id`، ولی کد برای هر سه جدول یک payload
 *   یکسان می‌فرستاد:
 *     POST categories {org_id, branch_id, name}
 *       → PGRST204: Could not find the 'branch_id' column
 *
 *   مهاجرت ۰۰۴۰ ستون‌ها را اضافه کرد، ولی `branch_id` روی
 *   categories عمداً پر نمی‌شود: دسته‌بندی کالا مفهومی در سطح
 *   کسب‌وکار است نه شعبه. فرستادن شعبه یعنی دسته‌ی ساخته‌شده در
 *   شعبه‌ی ۱ در شعبه‌ی ۲ دیده نشود — رفتاری که هیچ‌کس نمی‌خواهد.
 */
export const TABLE_USES_BRANCH: Record<ManagedTable, boolean> = {
  categories: false,
  brands: true,
  expense_categories: true,
};

/**
 * بدنه‌ی درخواست افزودن.
 *
 * کلید `branch_id` وقتی جدول پشتیبانی نمی‌کند **اصلاً وجود ندارد**،
 * نه اینکه `null` باشد. PostgREST ستون ناشناخته را حتی با مقدار
 * null رد می‌کند.
 */
export function buildInsertPayload(
  table: ManagedTable,
  orgId: string,
  branchId: string | null,
  name: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = { org_id: orgId, name: name.trim() };
  if (TABLE_USES_BRANCH[table] && branchId) payload.branch_id = branchId;
  return payload;
}

/** نام معتبر است؟ فاصله‌ی خالی نام نیست. */
export function isValidName(raw: unknown): boolean {
  return typeof raw === "string" && raw.trim().length > 0;
}

/**
 * پیام خطای قابل‌فهم از خطای Supabase.
 *
 * 🔴 چرا لازم است: کد قبلی نتیجه‌ی insert/update/delete را **اصلاً
 * بررسی نمی‌کرد** (`await supabase.from(...).insert(...)` بدون خواندن
 * `error`). وقتی جدول categories خراب بود، کاربر دکمه را می‌زد،
 * هیچ اتفاقی نمی‌افتاد و **هیچ پیامی هم نمی‌دید**. تنها نشانه، یک
 * خطای ۴۰۰ در کنسول مرورگر بود.
 */
export function friendlyError(error: { code?: string; message?: string } | null): string | null {
  if (!error) return null;

  // نقض ایندکس یکتا — نام تکراری در همان کسب‌وکار.
  if (error.code === "23505") return "این نام قبلاً ثبت شده است.";
  // نقض RLS — کاربر مجوز products.edit ندارد.
  if (error.code === "42501") return "شما اجازه‌ی تغییر این بخش را ندارید.";
  // ستون ناشناخته — یعنی مهاجرت اجرا نشده.
  if (error.code === "PGRST204" || error.code === "42703") {
    return "ساختار دیتابیس با نسخه‌ی برنامه هماهنگ نیست. با پشتیبانی تماس بگیرید.";
  }
  return error.message || "خطای ناشناخته";
}
