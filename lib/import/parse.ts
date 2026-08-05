/**
 * تبدیل سطرهای خام اکسل به رکوردهای آماده‌ی درج.
 *
 * عمداً از دیتابیس و Supabase جداست: منطق اعتبارسنجی باید بدون
 * سرور و بدون شبکه تست‌پذیر باشد.
 */

import {
  COLUMNS,
  cleanText,
  faNum,
  matchKey,
  normalizePhone,
  parseContactType,
  parseInteger,
  parseMoneyToRial,
  type ColumnDef,
  type ImportKind,
  type RowError,
} from "./schema";

/** سطر خام: کلید = عنوان ستون فارسی، مقدار = محتوای سلول. */
export type RawRow = Record<string, unknown>;

export interface ParsedProduct {
  rowNumber: number;
  name: string;
  code: string | null;
  barcode: string | null;
  category: string | null;
  brand: string | null;
  color: string | null;
  size: string | null;
  purchasePrice: number | null;   // ریال
  salePrice: number | null;       // ریال
  stock: number | null;
  lowStock: number | null;
  description: string | null;
  /** کلید تشخیص تکراری: بارکد، وگرنه کد، وگرنه نام+رنگ+سایز. */
  dedupeKey: string;
  dedupeBy: "barcode" | "code" | "name";
}

export interface ParsedContact {
  rowNumber: number;
  name: string;
  type: "customer" | "supplier" | "both";
  phone: string | null;
  code: string | null;
  address: string | null;
  creditLimit: number | null;     // ریال
  openingBalance: number | null;  // ریال
  description: string | null;
  dedupeKey: string;
  dedupeBy: "phone" | "code" | "name";
}

export interface ParseResult<T> {
  rows: T[];
  errors: RowError[];
  /** سطرهایی که در خودِ فایل تکراری بودند. */
  duplicatesInFile: RowError[];
}

/**
 * سرستون‌های فایل با تعریف ما تطبیق داده می‌شوند.
 *
 * چرا سخت‌گیر نیستیم؟ کاربر فایل را در اکسل باز می‌کند و ممکن است
 * فاصله‌ی اضافه بگذارد یا «ي» عربی به‌جای «ی» فارسی تایپ کند.
 * رد کردن فایل به‌خاطر یک نویسه، تجربه‌ی بدی است.
 */
export function normalizeHeader(header: string): string {
  return cleanText(header)
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** نگاشت سرستون فایل → کلید داخلی. */
export function mapHeaders(
  fileHeaders: string[],
  kind: ImportKind
): { map: Record<string, string>; missing: ColumnDef[]; unknown: string[] } {
  const defs = COLUMNS[kind];
  const byNormalized = new Map(defs.map((d) => [normalizeHeader(d.header), d]));

  const map: Record<string, string> = {};
  const unknown: string[] = [];

  for (const raw of fileHeaders) {
    const def = byNormalized.get(normalizeHeader(raw));
    if (def) map[raw] = def.key;
    else if (cleanText(raw) !== "") unknown.push(raw);
  }

  const found = new Set(Object.values(map));
  const missing = defs.filter((d) => d.required && !found.has(d.key));

  return { map, missing, unknown };
}

/** مقدار یک ستون از سطر خام، با استفاده از نگاشت سرستون‌ها. */
function pick(row: RawRow, map: Record<string, string>, key: string): unknown {
  for (const [header, mapped] of Object.entries(map)) {
    if (mapped === key) {
      const v = row[header];
      if (v !== undefined && v !== null && cleanText(v) !== "") return v;
    }
  }
  return undefined;
}

/**
 * شماره‌ی سطر آن‌طور که کاربر در اکسل می‌بیند.
 *
 * ایندکس صفرمبنای آرایه + ۱ برای سرستون + ۱ برای اینکه اکسل از ۱
 * شمارش می‌کند. بدون این، پیام «خطا در سطر ۵» کاربر را به سطر اشتباه
 * می‌فرستد.
 */
const excelRow = (index: number) => index + 2;

export function parseProducts(rows: RawRow[], map: Record<string, string>): ParseResult<ParsedProduct> {
  const out: ParsedProduct[] = [];
  const errors: RowError[] = [];
  const duplicatesInFile: RowError[] = [];
  const seen = new Map<string, number>();

  rows.forEach((raw, index) => {
    const rowNumber = excelRow(index);
    const name = cleanText(pick(raw, map, "name"));

    // سطر کاملاً خالی نادیده گرفته می‌شود، نه اینکه خطا بدهد:
    // فایل‌های اکسل معمولاً چند سطر خالی در انتها دارند.
    const anyValue = Object.values(raw).some((v) => cleanText(v) !== "");
    if (!anyValue) return;

    if (name === "") {
      errors.push({ row: rowNumber, column: "نام کالا", message: "نام کالا خالی است" });
      return;
    }
    if (name.length > 200) {
      errors.push({ row: rowNumber, column: "نام کالا", message: "نام کالا بیش از ۲۰۰ نویسه است" });
      return;
    }

    const purchasePrice = parseMoneyToRial(pick(raw, map, "purchase_price"));
    const salePrice = parseMoneyToRial(pick(raw, map, "sale_price"));
    const stock = parseInteger(pick(raw, map, "stock"));
    const lowStock = parseInteger(pick(raw, map, "low_stock"));

    /*
      مبلغ منفی رد می‌شود، ولی مبلغِ *نامفهوم* هم باید رد شود.
      اگر کاربر «۲۵۰ هزار» بنویسد، parseMoneyToRial مقدار null
      برمی‌گرداند؛ سکوت در برابر آن یعنی کالا با قیمت صفر ثبت شود و
      کاربر ماه‌ها بعد بفهمد.
    */
    const rawPurchase = pick(raw, map, "purchase_price");
    if (rawPurchase !== undefined && purchasePrice === null) {
      errors.push({ row: rowNumber, column: "قیمت خرید (تومان)", message: `عدد نامعتبر: «${cleanText(rawPurchase)}»` });
      return;
    }
    const rawSale = pick(raw, map, "sale_price");
    if (rawSale !== undefined && salePrice === null) {
      errors.push({ row: rowNumber, column: "قیمت فروش (تومان)", message: `عدد نامعتبر: «${cleanText(rawSale)}»` });
      return;
    }
    if ((purchasePrice ?? 0) < 0 || (salePrice ?? 0) < 0) {
      errors.push({ row: rowNumber, message: "قیمت نمی‌تواند منفی باشد" });
      return;
    }
    const rawStock = pick(raw, map, "stock");
    if (rawStock !== undefined && stock === null) {
      errors.push({ row: rowNumber, column: "موجودی اولیه", message: `عدد نامعتبر: «${cleanText(rawStock)}»` });
      return;
    }
    if ((stock ?? 0) < 0) {
      errors.push({ row: rowNumber, column: "موجودی اولیه", message: "موجودی نمی‌تواند منفی باشد" });
      return;
    }

    const barcode = cleanText(pick(raw, map, "barcode")) || null;
    const code = cleanText(pick(raw, map, "code")) || null;
    const color = cleanText(pick(raw, map, "color")) || null;
    const size = cleanText(pick(raw, map, "size")) || null;

    /*
      اولویت تشخیص تکراری: بارکد → کد → نام+رنگ+سایز.
      بارکد یکتاترین است. نام به‌تنهایی کافی نیست چون یک پیراهن در
      سه رنگ، سه واریانت متفاوت است و نباید تکراری حساب شود.
    */
    const dedupeBy: ParsedProduct["dedupeBy"] = barcode ? "barcode" : code ? "code" : "name";
    const dedupeKey = matchKey(
      barcode ?? code ?? [name, color ?? "", size ?? ""].join("|")
    );

    const previous = seen.get(dedupeKey);
    if (previous !== undefined) {
      duplicatesInFile.push({
        row: rowNumber,
        message: `تکراری با سطر ${faNum(previous)} در همین فایل`,
      });
      return;
    }
    seen.set(dedupeKey, rowNumber);

    out.push({
      rowNumber, name, code, barcode,
      category: cleanText(pick(raw, map, "category")) || null,
      brand: cleanText(pick(raw, map, "brand")) || null,
      color, size, purchasePrice, salePrice, stock, lowStock,
      description: cleanText(pick(raw, map, "description")) || null,
      dedupeKey, dedupeBy,
    });
  });

  return { rows: out, errors, duplicatesInFile };
}

export function parseContacts(rows: RawRow[], map: Record<string, string>): ParseResult<ParsedContact> {
  const out: ParsedContact[] = [];
  const errors: RowError[] = [];
  const duplicatesInFile: RowError[] = [];
  const seen = new Map<string, number>();

  rows.forEach((raw, index) => {
    const rowNumber = excelRow(index);
    const anyValue = Object.values(raw).some((v) => cleanText(v) !== "");
    if (!anyValue) return;

    const name = cleanText(pick(raw, map, "name"));
    if (name === "") {
      errors.push({ row: rowNumber, column: "نام", message: "نام خالی است" });
      return;
    }
    if (name.length > 200) {
      errors.push({ row: rowNumber, column: "نام", message: "نام بیش از ۲۰۰ نویسه است" });
      return;
    }

    const type = parseContactType(pick(raw, map, "type"));
    if (type === null) {
      errors.push({
        row: rowNumber, column: "نوع",
        message: `نوع نامعتبر: «${cleanText(pick(raw, map, "type"))}» — مشتری، تأمین‌کننده یا هردو`,
      });
      return;
    }

    /*
      شماره‌ی نامعتبر خطا می‌دهد، ولی شماره‌ی *خالی* نه.
      خیلی از مشتریان حضوری شماره ندارند و رد کردنشان یعنی کاربر
      مجبور شود شماره‌ی الکی بسازد.
    */
    const rawPhone = pick(raw, map, "phone");
    const phone = normalizePhone(rawPhone);
    if (rawPhone !== undefined && phone === null) {
      errors.push({
        row: rowNumber, column: "موبایل",
        message: `شماره نامعتبر: «${cleanText(rawPhone)}» — باید ۱۱ رقم و با ۰۹ شروع شود`,
      });
      return;
    }

    const creditLimit = parseMoneyToRial(pick(raw, map, "credit_limit"));
    const openingBalance = parseMoneyToRial(pick(raw, map, "opening_balance"));
    if ((creditLimit ?? 0) < 0) {
      errors.push({ row: rowNumber, column: "سقف اعتبار (تومان)", message: "سقف اعتبار نمی‌تواند منفی باشد" });
      return;
    }

    const code = cleanText(pick(raw, map, "code")) || null;
    const dedupeBy: ParsedContact["dedupeBy"] = phone ? "phone" : code ? "code" : "name";
    const dedupeKey = matchKey(phone ?? code ?? name);

    const previous = seen.get(dedupeKey);
    if (previous !== undefined) {
      duplicatesInFile.push({ row: rowNumber, message: `تکراری با سطر ${faNum(previous)} در همین فایل` });
      return;
    }
    seen.set(dedupeKey, rowNumber);

    out.push({
      rowNumber, name, type, phone, code,
      address: cleanText(pick(raw, map, "address")) || null,
      creditLimit, openingBalance,
      description: cleanText(pick(raw, map, "description")) || null,
      dedupeKey, dedupeBy,
    });
  });

  return { rows: out, errors, duplicatesInFile };
}
