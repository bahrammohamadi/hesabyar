import * as XLSX from "@e965/xlsx";
import {
  COLUMNS,
  KIND_LABEL,
  MAX_ROWS,
  cleanText,
  type ImportKind,
} from "./schema";
import type { RawRow } from "./parse";

/**
 * ساخت و خواندن فایل اکسل.
 *
 * ⚠️ چرا `@e965/xlsx` و نه `xlsx`؟
 *   بسته‌ی `xlsx` روی npm در نسخه‌ی ۰٫۱۸٫۵ متوقف شده و آسیب‌پذیری
 *   Prototype Pollution دارد (CVE-2023-30533): یک فایل دستکاری‌شده
 *   می‌تواند `Object.prototype` را آلوده کند. نسخه‌ی وصله‌شده فقط از
 *   CDN خودِ SheetJS پخش می‌شود و روی npm نیست.
 *   `@e965/xlsx` همان نسخه‌ی رسمی وصله‌شده (۰٫۲۰٫۳) است که روی npm
 *   بازنشر می‌شود. صفر وابستگی دارد.
 *
 *   بررسی عملی انجام شد: با شیتی که کلید `__proto__` دارد،
 *   `({}).polluted` تعریف‌نشده ماند و کلید به `__proto___NaN` تبدیل شد.
 *
 *   `exceljs` بررسی و رد شد: نگهداری نمی‌شود و زنجیره‌ی وابستگی‌اش
 *   (archiver → glob 7 → inflight) چند CVE باز دارد.
 */

/** سطر راهنما بالای هر شیت. */
const GUIDE_HEADER = "راهنما (این سطر را پاک نکنید — هنگام خواندن نادیده گرفته می‌شود)";

/**
 * قالب خام برای دانلود.
 *
 * سه شیت دارد:
 *   ۱ «داده»    — سرستون‌ها + یک سطر نمونه که کاربر رویش می‌نویسد
 *   ۲ «راهنما»  — توضیح هر ستون
 *   ۳ «فهرست»   — دسته‌ها و برندهای موجود، برای کپی دقیق
 *
 * چرا سطر نمونه داخل شیت داده؟ بدون آن، کاربر نمی‌داند «۲۵۰۰۰۰» را
 * با کاما بنویسد یا نه، و «مشتری» را فارسی یا انگلیسی. یک نمونه‌ی
 * واقعی از هر توضیحی گویاتر است.
 */
export function buildTemplate(
  kind: ImportKind,
  context?: { categories?: string[]; brands?: string[] }
): Buffer {
  const defs = COLUMNS[kind];
  const wb = XLSX.utils.book_new();

  /* ── شیت ۱: داده ── */
  const dataSheet = XLSX.utils.aoa_to_sheet([
    defs.map((d) => d.header),
    defs.map((d) => d.sample),
  ]);
  // عرض ستون‌ها بر اساس طول عنوان؛ بدون آن همه‌ی ستون‌ها باریک‌اند و
  // کاربر باید تک‌تک پهنشان کند.
  dataSheet["!cols"] = defs.map((d) => ({ wch: Math.max(14, d.header.length + 4) }));
  // راست‌به‌چپ — فایل فارسی در اکسل باید از راست باز شود.
  dataSheet["!views"] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, dataSheet, "داده");

  /* ── شیت ۲: راهنما ── */
  const guideRows: (string | number)[][] = [
    [GUIDE_HEADER],
    [],
    ["ستون", "اجباری؟", "توضیح", "نمونه"],
    ...defs.map((d) => [
      d.header,
      d.required ? "بله" : "خیر",
      d.hint,
      String(d.sample ?? ""),
    ]),
    [],
    ["نکته‌های مهم:"],
    ["۱. سطر اول شیت «داده» را دست نزنید — نام ستون‌ها از همان خوانده می‌شود."],
    ["۲. سطر نمونه را پاک کنید و داده‌ی خودتان را از سطر دوم بنویسید."],
    ["۳. مبالغ به تومان و فقط عدد؛ بدون کاما و بدون کلمه‌ی «تومان»."],
    ["۴. ارقام فارسی مشکلی ندارد — سیستم خودش تبدیل می‌کند."],
    [`۵. حداکثر ${MAX_ROWS} سطر در هر فایل. بیشتر بود، چند فایل بفرستید.`],
    ["۶. ستون‌هایی که لازم ندارید را خالی بگذارید؛ ستون را حذف نکنید."],
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
  guideSheet["!cols"] = [{ wch: 24 }, { wch: 10 }, { wch: 62 }, { wch: 20 }];
  guideSheet["!views"] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, guideSheet, "راهنما");

  /* ── شیت ۳: فهرست‌های موجود ── */
  if (kind === "products") {
    const cats = context?.categories ?? [];
    const brands = context?.brands ?? [];
    const maxLen = Math.max(cats.length, brands.length, 1);
    const rows: string[][] = [
      ["دسته‌بندی‌های موجود", "برندهای موجود"],
      ...Array.from({ length: maxLen }, (_, i) => [cats[i] ?? "", brands[i] ?? ""]),
      [],
      ["⚠️ دسته‌بندی باید دقیقاً یکی از نام‌های بالا باشد."],
      ["   اگر دسته‌ی جدیدی می‌خواهید، اول از «تنظیمات ← کاتالوگ» بسازید."],
      ["   برند تازه اشکالی ندارد — خودکار ساخته می‌شود."],
    ];
    const listSheet = XLSX.utils.aoa_to_sheet(rows);
    listSheet["!cols"] = [{ wch: 30 }, { wch: 30 }];
    listSheet["!views"] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, listSheet, "فهرست");
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export const templateFileName = (kind: ImportKind) =>
  `tarazoo-template-${kind}.xlsx`;

export const templateTitle = (kind: ImportKind) =>
  `قالب ورود ${KIND_LABEL[kind]}`;

export interface ReadResult {
  headers: string[];
  rows: RawRow[];
  sheetName: string;
  truncated: boolean;
}

/**
 * خواندن فایل کاربر.
 *
 * شیت «داده» ترجیح داده می‌شود؛ اگر نبود، اولین شیت. کاربر ممکن است
 * قالب را در Google Sheets باز کند و نام شیت عوض شود.
 */
/**
 * آیا این بایت‌ها واقعاً یک فایل xlsx (که در اصل یک ZIP است) هستند؟
 *
 * 🔴 چرا لازم شد: SheetJS قالب را حدس می‌زند و *هر* متنی را به‌عنوان
 * CSV می‌پذیرد. یک تست با محتوای «این یک فایل اکسل نیست» بدون خطا
 * خوانده شد و یک سرستون به‌هم‌ریخته
 * («Ø§ÛÙ ÛÚ© ÙØ§ÛÙ...») برگرداند.
 *
 * نتیجه‌ی عملی: کاربری که اشتباهی PDF یا عکس آپلود می‌کند، به‌جای
 * «این فایل اکسل نیست»، پیام گیج‌کننده‌ی «ستون اجباری نام کالا در
 * فایل نیست» می‌گرفت و دنبال ستونی می‌گشت که اصلاً وجود نداشت.
 */
function looksLikeXlsx(bytes: Uint8Array): boolean {
  // امضای ZIP: PK\x03\x04 (فایل خالی/تکه‌شده: PK\x05\x06 و PK\x07\x08)
  return (
    bytes.length > 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
  );
}

/**
 * آیا محتوا یک CSV متنی معتبر است؟
 *
 * CSV عمداً پشتیبانی می‌شود: خیلی از نرم‌افزارهای قدیمی حسابداری فقط
 * CSV می‌دهند و مجبورکردن کاربر به تبدیل دستی، مانع بی‌دلیلی است.
 * ولی باید *تشخیص داده* شود، نه اینکه هر زباله‌ای CSV فرض شود.
 */
function looksLikeCsv(bytes: Uint8Array): boolean {
  try {
    // fatal:true یعنی بایت نامعتبر UTF-8 استثنا می‌دهد — همان چیزی که
    // یک فایل باینری (عکس/PDF) را رد می‌کند.
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    // حداقل یک جداکننده در سطر اول: یک متن آزاد CSV نیست.
    return firstLine.includes(",") || firstLine.includes("\t") || firstLine.includes("؛");
  } catch {
    return false;
  }
}

export class UnsupportedFileError extends Error {
  constructor() {
    super("فایل ارسالی اکسل (xlsx) یا CSV نیست. لطفاً از قالب خام استفاده کنید.");
    this.name = "UnsupportedFileError";
  }
}

export function readWorkbook(buffer: ArrayBuffer | Buffer): ReadResult {
  const bytes = buffer instanceof Buffer ? new Uint8Array(buffer) : new Uint8Array(buffer);

  /*
    🔴 تشخیص قالب پیش از سپردن به SheetJS.
    بدون این، هر فایلی «خوانده» می‌شد و کاربر پیام اشتباه می‌گرفت.
  */
  if (!looksLikeXlsx(bytes) && !looksLikeCsv(bytes)) {
    throw new UnsupportedFileError();
  }

  /*
    ⚠️ گزینه‌های خواندن عمداً محدودند:
      cellFormula:false → فرمول‌ها اجرا/ذخیره نمی‌شوند
      cellHTML:false    → محتوای سلول به‌عنوان HTML تفسیر نمی‌شود
    فایل از کاربر می‌آید و هرچه کمتر تفسیر شود، بهتر.
  */
  const isCsv = !looksLikeXlsx(bytes);

  /*
    🔴 CSV باید صریحاً به‌عنوان رشته‌ی UTF-8 داده شود.

    با `type:"buffer"`، SheetJS بایت‌ها را Latin-1 فرض می‌کند و هر
    نویسه‌ی فارسی خراب می‌شود: «نام» به «ÙØ§Ù» تبدیل شد. فایل بدون
    خطا خوانده می‌شد ولی هیچ ستونی شناخته نمی‌شد و کاربر پیام
    بی‌ربط «ستون اجباری نیست» می‌گرفت.

    BOM هم برداشته می‌شود؛ اکسل ویندوز آن را در ابتدای CSV می‌گذارد و
    اولین سرستون را نامرئی خراب می‌کند.
  */
  const source = isCsv
    ? new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "")
    : buffer;

  const wb = XLSX.read(source, {
    type: isCsv ? "string" : "buffer",
    cellDates: false,
    cellFormula: false,
    cellHTML: false,
    dense: false,
  });

  const sheetName =
    wb.SheetNames.find((n) => cleanText(n) === "داده") ?? wb.SheetNames[0];
  if (!sheetName) throw new Error("فایل هیچ شیتی ندارد");

  const sheet = wb.Sheets[sheetName];

  /*
    defval:"" لازم است. بدون آن، سلول خالی اصلاً کلید نمی‌گیرد و
    تشخیص «ستون وجود دارد ولی خالی است» از «ستون نیست» ممکن نمی‌شود.
    raw:false مقادیر را رشته می‌دهد تا قالب‌بندی اکسل (مثل نمایش
    ۱٬۲۵۰٬۰۰۰) به عدد اشتباه تبدیل نشود؛ خودمان پارس می‌کنیم.
  */
  const json = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    defval: "",
    raw: false,
    blankrows: false,
  });

  const headerRow = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    range: 0,
    blankrows: false,
  })[0];
  const headers = Array.isArray(headerRow) ? headerRow.map((h) => cleanText(h)) : [];

  const truncated = json.length > MAX_ROWS;
  return {
    headers,
    rows: truncated ? json.slice(0, MAX_ROWS) : json,
    sheetName,
    truncated,
  };
}

/**
 * گزارش خطاها به شکل فایل اکسل قابل دانلود.
 *
 * چرا فایل و نه فقط فهرست روی صفحه؟ وقتی ۸۰ سطر ایراد دارد، کاربر
 * باید بتواند کنار فایل اصلی بازش کند و سطربه‌سطر اصلاح کند. اسکرول
 * در یک کادر کوچک برای این کار بی‌فایده است.
 */
export function buildErrorReport(
  errors: { row: number; column?: string; message: string }[]
): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["شماره سطر در فایل", "ستون", "ایراد"],
    ...errors.map((e) => [e.row, e.column ?? "—", e.message]),
  ]);
  ws["!cols"] = [{ wch: 18 }, { wch: 24 }, { wch: 70 }];
  ws["!views"] = [{ RTL: true }];
  XLSX.utils.book_append_sheet(wb, ws, "ایرادها");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
