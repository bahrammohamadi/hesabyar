import * as XLSX from "@e965/xlsx";
import { BACKUP_TABLES, summarize, type TableResult } from "./backup";
import { toEnDigits } from "@/lib/utils/format";

/**
 * ساخت فایل اکسل پشتیبان.
 *
 * از همان `@e965/xlsx` استفاده می‌کند که در بخش «ورود اطلاعات»
 * انتخاب شد — بسته‌ی `xlsx` روی npm آسیب‌پذیری وصله‌نشده‌ی
 * CVE-2023-30533 دارد.
 */

/** برچسب فارسی ستون‌ها؛ هرچه اینجا نباشد با نام خام می‌آید. */
const COLUMN_LABEL: Record<string, string> = {
  id: "شناسه",
  code: "کد",
  name: "نام",
  type: "نوع",
  phone: "تلفن",
  address: "نشانی",
  description: "توضیح",
  is_active: "فعال",
  created_at: "تاریخ ثبت",
  category_id: "شناسه دسته",
  brand_id: "شناسه برند",
  product_id: "شناسه کالا",
  variant_id: "شناسه تنوع",
  base_purchase_price: "قیمت خرید پایه",
  base_sale_price: "قیمت فروش پایه",
  purchase_price: "قیمت خرید",
  sale_price: "قیمت فروش",
  stock_qty: "موجودی",
  low_stock_threshold: "حد هشدار موجودی",
  season: "فصل",
  material: "جنس",
  sku: "کد انبار",
  barcode: "بارکد",
  color: "رنگ",
  size: "سایز",
  credit_limit: "سقف اعتبار",
  opening_balance: "مانده اولیه",
  bank_name: "نام بانک",
  account_no: "شماره حساب",
  invoice_no: "شماره فاکتور",
  date: "تاریخ",
  customer_id: "شناسه مشتری",
  contact_id: "شناسه شخص",
  account_id: "شناسه حساب",
  expense_category_id: "شناسه دسته هزینه",
  sale_id: "شناسه فاکتور فروش",
  purchase_id: "شناسه فاکتور خرید",
  subtotal: "جمع جزء",
  discount: "تخفیف",
  tax: "مالیات",
  total: "جمع کل",
  paid_cash: "نقد",
  paid_card: "کارت",
  paid_credit: "نسیه",
  status: "وضعیت",
  note: "یادداشت",
  cancelled_at: "تاریخ ابطال",
  cancel_reason: "دلیل ابطال",
  qty: "تعداد",
  unit_price: "قیمت واحد",
  line_total: "جمع سطر",
  cost_price: "بهای تمام‌شده",
  amount: "مبلغ",
  method: "روش",
  reason: "علت",
  ref_table: "جدول مرجع",
  ref_id: "شناسه مرجع",
  balance_after: "موجودی پس از",
};

const label = (key: string) => COLUMN_LABEL[key] ?? key;

/**
 * 🔴 خنثی‌سازی فرمول در سلول اکسل.
 *
 * همان مشکل CSV Injection، ولی اینجا مستقیم در فایل xlsx. اگر مقدار
 * متنی با `=`، `+`، `@` یا `-` (که عدد نباشد) شروع شود، اکسل آن را
 * فرمول اجرا می‌کند.
 *
 * فقط رشته‌ها لمس می‌شوند؛ عدد و تاریخ و بولین دست‌نخورده می‌مانند تا
 * در اکسل قابل جمع‌زدن باشند.
 */
function sanitizeCell(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const dangerous = /^[=+@\t\r]/.test(value) || /^-(?![\d.])/.test(value);
  return dangerous ? `'${value}` : value;
}

/**
 * مقدارِ آماده‌ی نمایش.
 *
 * `null` به رشته‌ی خالی تبدیل می‌شود نه «null»؛ و بولین به بله/خیر،
 * چون «TRUE» در ستون «فعال» برای کاربر فارسی‌زبان معنا ندارد.
 */
function cellValue(value: unknown): unknown {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "بله" : "خیر";
  if (typeof value === "object") return JSON.stringify(value);
  return sanitizeCell(value);
}

export function buildBackupWorkbook(
  results: TableResult[],
  meta: { orgName: string; generatedAt: string; generatedBy: string }
): Buffer {
  const wb = XLSX.utils.book_new();
  const { total, truncatedTables } = summarize(results);

  /*
    شیت اول: فهرست و راهنما.

    چرا اول؟ کاربری که فایل را شش ماه بعد باز می‌کند باید بلافاصله
    بفهمد این چیست، از کِی است و چه چیزی داخلش هست — نه اینکه با
    شیتی از شناسه‌های UUID روبه‌رو شود.
  */
  const indexRows: (string | number)[][] = [
    ["پشتیبان کامل اطلاعات"],
    [],
    ["کسب‌وکار", meta.orgName],
    ["تاریخ تهیه", meta.generatedAt],
    ["تهیه‌کننده", meta.generatedBy],
    ["مجموع رکوردها", total],
    [],
    ["شیت", "تعداد رکورد"],
    ...results.map((r) => [r.sheet, r.rows.length] as (string | number)[]),
  ];

  if (truncatedTables.length > 0) {
    /*
      صداقت درباره‌ی ناقص بودن.
      یک پشتیبانِ ناقص که خودش را کامل نشان بدهد، از نبودِ پشتیبان
      خطرناک‌تر است.
    */
    indexRows.push(
      [],
      ["⚠️ هشدار: این شیت‌ها به سقف رسیدند و کامل نیستند:"],
      [truncatedTables.join("، ")],
      ["برای دریافت کامل، با پشتیبانی تماس بگیرید."]
    );
  }

  indexRows.push(
    [],
    ["راهنما"],
    ["این فایل فقط برای نگهداری و مرور است؛ برای بازگردانی مستقیم طراحی نشده."],
    ["ستون‌های «شناسه» برای ارتباط بین شیت‌هاست (مثلاً شناسه کالا در شیت تنوع کالا)."],
    ["مبالغ به ریال ذخیره شده‌اند — همان واحدی که در دیتابیس است."]
  );

  const indexSheet = XLSX.utils.aoa_to_sheet(indexRows);
  indexSheet["!cols"] = [{ wch: 28 }, { wch: 42 }];
  XLSX.utils.book_append_sheet(wb, indexSheet, "فهرست");

  for (const result of results) {
    const spec = BACKUP_TABLES.find((t) => t.key === result.key);
    const columns = spec?.columns ?? Object.keys(result.rows[0] ?? {});

    const aoa: unknown[][] = [columns.map(label)];
    for (const row of result.rows) {
      aoa.push(columns.map((c) => cellValue(row[c])));
    }
    /*
      شیت خالی هم ساخته می‌شود.
      حذف شیتِ بی‌ردیف باعث می‌شد کاربر فکر کند فراموش شده؛ سرستونِ
      تنها روشن می‌گوید «این بخش خالی است».
    */
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    sheet["!cols"] = columns.map(() => ({ wch: 18 }));
    /*
      ⚠️ نام شیت در اکسل حداکثر ۳۱ نویسه و بدون : \ / ? * [ ]
      نام‌های ما کوتاه‌اند ولی برش دفاعی می‌گذاریم تا افزودن شیت
      جدید در آینده فایل را خراب نکند.
    */
    XLSX.utils.book_append_sheet(wb, sheet, result.sheet.slice(0, 31));
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/**
 * نام فایل — فقط ASCII.
 *
 * 🔴 باگی که فقط با اجرای واقعی پیدا شد (نه در tsc و نه در build):
 *   `todayJalali()` تاریخ را با **ارقام فارسی** برمی‌گرداند
 *   («۱۴۰۵/۰۵/۱۹»). این رشته مستقیم داخل هدر
 *   `Content-Disposition` می‌رفت و Node پرتاب می‌کرد:
 *
 *     TypeError: Cannot convert argument to a ByteString because the
 *     character at index 37 has a value of 1778 which is greater than 255
 *
 *   نتیجه: کل درخواست ۵۰۰ می‌داد و هیچ فایلی دانلود نمی‌شد. کامنت
 *   قبلی ادعا می‌کرد «نام ASCII است» ولی هیچ کدی آن را تضمین
 *   نمی‌کرد — دقیقاً همان فاصله‌ی «ظاهری» با «واقعاً پیاده‌شده».
 *
 *   حالا ارقام فارسی به لاتین تبدیل و هر نویسه‌ی غیر-ASCII حذف
 *   می‌شود، و در انتها یک گارد نهایی هست تا اگر روزی ورودی عوض شد
 *   باز هم هدر سالم بماند.
 */
export function backupFileName(jalaliDate: string): string {
  const ascii = toEnDigits(jalaliDate)
    .replace(/\//g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
  // اگر ورودی کاملاً غیر-ASCII بود، دست‌کم یک نام معتبر برگردانیم.
  return `tarazoo-backup-${ascii || "export"}.xlsx`;
}
