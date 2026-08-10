/**
 * پشتیبان کامل کسب‌وکار.
 *
 * چرا لازم شد: راهنمای «ورود اطلاعات از اکسل» به کاربر می‌گوید
 * «پیش از هر کاری از اطلاعات خود پشتیبان بگیرید» — ولی هیچ دکمه‌ای
 * برای این کار وجود نداشت. توصیه‌ای که راهش را نشان ندهیم، توصیه
 * نیست.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * جدول‌هایی که در پشتیبان می‌آیند، به ترتیبِ وابستگی.
 *
 * ترتیب مهم است: اگر روزی «بازگردانی» ساختیم، باید کالا پیش از
 * واریانت و واریانت پیش از قلم فاکتور درج شود.
 *
 * ⚠️ چرا `select` صریح و نه `*`؟
 *   با `*`، افزودن یک ستون حساس در آینده (مثلاً توکن یا کلید) به‌طور
 *   خودکار وارد فایل پشتیبانِ کاربر می‌شد. فهرست صریح یعنی هر ستون
 *   تازه باید آگاهانه اضافه شود.
 */
export type BackupTable = {
  key: string;
  /** نام شیت در فایل اکسل — کوتاه، چون اکسل سقف ۳۱ نویسه دارد. */
  sheet: string;
  table: string;
  columns: string[];
  /** ستونی که برای فیلتر سازمان استفاده می‌شود. */
  orgColumn: string;
  /** ترتیب پایدار خروجی. */
  orderBy: string;
};

export const BACKUP_TABLES: BackupTable[] = [
  {
    key: "categories", sheet: "دسته‌بندی", table: "categories", orgColumn: "org_id",
    columns: ["id", "name", "is_active", "created_at"], orderBy: "name",
  },
  {
    key: "brands", sheet: "برندها", table: "brands", orgColumn: "org_id",
    columns: ["id", "name", "is_active", "created_at"], orderBy: "name",
  },
  {
    key: "products", sheet: "کالاها", table: "products", orgColumn: "org_id",
    columns: [
      "id", "code", "name", "category_id", "brand_id", "description",
      "base_purchase_price", "base_sale_price", "low_stock_threshold",
      "season", "material", "is_active", "created_at",
    ],
    orderBy: "name",
  },
  {
    key: "variants", sheet: "تنوع کالا", table: "product_variants", orgColumn: "org_id",
    columns: [
      "id", "product_id", "sku", "barcode", "color", "size",
      "purchase_price", "sale_price", "stock_qty", "is_active", "created_at",
    ],
    orderBy: "created_at",
  },
  {
    key: "contacts", sheet: "اشخاص", table: "contacts", orgColumn: "org_id",
    columns: [
      "id", "code", "name", "type", "phone", "address", "description",
      "credit_limit", "opening_balance", "is_active", "created_at",
    ],
    orderBy: "name",
  },
  {
    key: "accounts", sheet: "حساب‌ها", table: "accounts", orgColumn: "org_id",
    columns: ["id", "name", "type", "bank_name", "account_no", "opening_balance", "is_active"],
    orderBy: "name",
  },
  {
    key: "expense_categories", sheet: "دسته هزینه", table: "expense_categories", orgColumn: "org_id",
    columns: ["id", "name", "is_active"], orderBy: "name",
  },
  {
    key: "sales", sheet: "فاکتور فروش", table: "sales", orgColumn: "org_id",
    columns: [
      "id", "invoice_no", "date", "customer_id", "subtotal", "discount", "tax",
      "total", "paid_cash", "paid_card", "paid_credit", "status", "note",
      "cancelled_at", "cancel_reason", "created_at",
    ],
    orderBy: "date",
  },
  {
    key: "sale_items", sheet: "اقلام فروش", table: "sale_items", orgColumn: "org_id",
    columns: ["id", "sale_id", "variant_id", "qty", "unit_price", "discount", "line_total", "cost_price"],
    orderBy: "created_at",
  },
  {
    key: "transactions", sheet: "تراکنش مالی", table: "transactions", orgColumn: "org_id",
    columns: [
      "id", "type", "amount", "date", "account_id", "contact_id",
      "expense_category_id", "method", "note", "sale_id", "purchase_id",
    ],
    orderBy: "date",
  },
  {
    key: "stock_movements", sheet: "گردش انبار", table: "stock_movements", orgColumn: "org_id",
    columns: ["id", "variant_id", "type", "reason", "qty", "ref_table", "ref_id", "note", "balance_after", "created_at"],
    orderBy: "created_at",
  },
];

/**
 * سقف ردیف در هر جدول.
 *
 * ⚠️ چرا سقف لازم است: PostgREST به‌طور پیش‌فرض ۱۰۰۰ ردیف برمی‌گرداند.
 * بدون صفحه‌بندی صریح، پشتیبانِ کسب‌وکاری با ۵۰۰۰ حرکت انبار **بی‌صدا
 * ناقص** می‌شد — بدترین نوع خرابی در یک ابزار پشتیبان، چون کاربر
 * فکر می‌کند همه‌چیز را دارد.
 *
 * پس صفحه‌بندی انجام می‌شود و اگر به سقف سخت خوردیم، صریحاً در
 * فایل گزارش می‌شود.
 */
export const PAGE_SIZE = 1000;
export const MAX_ROWS_PER_TABLE = 50_000;

export type TableResult = {
  key: string;
  sheet: string;
  rows: Record<string, unknown>[];
  /** آیا به سقف خوردیم و داده‌ای جا ماند؟ */
  truncated: boolean;
};

/**
 * خواندن همه‌ی ردیف‌های یک جدول با صفحه‌بندی.
 *
 * برخلاف بقیه‌ی کوئری‌های برنامه که یک `limit` ثابت دارند، اینجا
 * *همه‌ی* داده لازم است — این تمام نکته‌ی پشتیبان است.
 */
export async function fetchTable(
  svc: SupabaseClient,
  spec: BackupTable,
  orgId: string
): Promise<TableResult> {
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  let truncated = false;

  for (;;) {
    const { data, error } = await svc
      .from(spec.table)
      .select(spec.columns.join(","))
      .eq(spec.orgColumn, orgId)
      .order(spec.orderBy, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...batch);

    // صفحه‌ی ناقص یعنی به انتها رسیدیم.
    if (batch.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
    if (rows.length >= MAX_ROWS_PER_TABLE) {
      truncated = true;
      break;
    }
  }

  return { key: spec.key, sheet: spec.sheet, rows, truncated };
}

/** خلاصه‌ی تعداد ردیف هر جدول — برای شیت «فهرست» و پیام موفقیت. */
export function summarize(results: TableResult[]): { total: number; truncatedTables: string[] } {
  return {
    total: results.reduce((sum, r) => sum + r.rows.length, 0),
    truncatedTables: results.filter((r) => r.truncated).map((r) => r.sheet),
  };
}
