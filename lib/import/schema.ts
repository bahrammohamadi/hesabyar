/**
 * تعریف ستون‌های فایل ورودی و قواعد اعتبارسنجی.
 *
 * چرا یک منبع واحد؟
 *   همین تعریف هم قالب خام اکسل را می‌سازد، هم فایل کاربر را
 *   می‌خواند، هم راهنمای روی صفحه را پر می‌کند. اگر جدا بودند، روزی
 *   قالبی تحویل کاربر می‌دادیم که خودمان نمی‌توانستیم بخوانیم.
 */

export type ImportKind = "products" | "contacts";

export type ColumnType = "text" | "number" | "money" | "phone" | "list" | "int";

export interface ColumnDef {
  /** عنوان فارسی — همان چیزی که در سطر اول اکسل نوشته می‌شود. */
  header: string;
  /** نام داخلی. هرگز به کاربر نشان داده نمی‌شود. */
  key: string;
  type: ColumnType;
  required?: boolean;
  /** توضیح کوتاه زیر ستون در شیت راهنما. */
  hint: string;
  /** نمونه‌ی مقدار برای سطر نمونه. */
  sample: string | number;
  /** مقادیر مجاز برای ستون از نوع list. */
  options?: { value: string; label: string }[];
  maxLength?: number;
}

/* ─────────────────────────── کالاها ─────────────────────────── */

export const PRODUCT_COLUMNS: ColumnDef[] = [
  {
    header: "نام کالا",
    key: "name",
    type: "text",
    required: true,
    hint: "اجباری — نام کاملی که در فاکتور دیده می‌شود",
    sample: "پیراهن مردانه آستین بلند",
    maxLength: 200,
  },
  {
    header: "کد کالا",
    key: "code",
    type: "text",
    hint: "اختیاری — خالی بگذارید تا سیستم خودش بسازد",
    sample: "P-1001",
    maxLength: 50,
  },
  {
    header: "بارکد",
    key: "barcode",
    type: "text",
    hint: "اختیاری — بارکد روی کالا",
    sample: "6260100123456",
    maxLength: 60,
  },
  {
    header: "دسته‌بندی",
    key: "category",
    type: "text",
    hint: "باید دقیقاً یکی از دسته‌های موجود باشد؛ نام تازه ساخته نمی‌شود",
    sample: "",
    maxLength: 80,
  },
  {
    header: "برند",
    key: "brand",
    type: "text",
    hint: "اگر برند تازه باشد، ساخته می‌شود",
    sample: "نمونه برند",
    maxLength: 80,
  },
  {
    header: "رنگ",
    key: "color",
    type: "text",
    hint: "اختیاری — برای کالای تک‌رنگ خالی بگذارید",
    sample: "آبی",
    maxLength: 40,
  },
  {
    header: "سایز",
    key: "size",
    type: "text",
    hint: "اختیاری — مثلاً L یا ۴۲",
    sample: "L",
    maxLength: 40,
  },
  {
    header: "قیمت خرید (تومان)",
    key: "purchase_price",
    type: "money",
    hint: "فقط عدد — بدون «تومان» و بدون کاما",
    sample: 250000,
  },
  {
    header: "قیمت فروش (تومان)",
    key: "sale_price",
    type: "money",
    hint: "فقط عدد — بدون «تومان» و بدون کاما",
    sample: 390000,
  },
  {
    header: "موجودی اولیه",
    key: "stock",
    type: "int",
    hint: "تعداد فعلی در انبار؛ یک سند انبارگردانی خودکار ثبت می‌شود",
    sample: 12,
  },
  {
    header: "حد هشدار موجودی",
    key: "low_stock",
    type: "int",
    hint: "وقتی موجودی به این عدد برسد هشدار می‌گیرید (پیش‌فرض ۳)",
    sample: 3,
  },
  {
    header: "توضیحات",
    key: "description",
    type: "text",
    hint: "اختیاری",
    sample: "",
    maxLength: 500,
  },
];

/* ────────────────────────── مخاطبین ────────────────────────── */

export const CONTACT_COLUMNS: ColumnDef[] = [
  {
    header: "نام",
    key: "name",
    type: "text",
    required: true,
    hint: "اجباری — نام شخص یا شرکت",
    sample: "علی محمدی",
    maxLength: 200,
  },
  {
    header: "نوع",
    key: "type",
    type: "list",
    hint: "مشتری، تأمین‌کننده یا هردو — خالی یعنی مشتری",
    sample: "مشتری",
    options: [
      { value: "customer", label: "مشتری" },
      { value: "supplier", label: "تأمین‌کننده" },
      { value: "both", label: "هردو" },
    ],
  },
  {
    header: "موبایل",
    key: "phone",
    type: "phone",
    hint: "مثل ۰۹۱۲۱۲۳۴۵۶۷ — مبنای تشخیص تکراری بودن همین است",
    sample: "09121234567",
  },
  {
    header: "کد",
    key: "code",
    type: "text",
    hint: "اختیاری — خالی بگذارید تا سیستم خودش بسازد",
    sample: "",
    maxLength: 50,
  },
  {
    header: "آدرس",
    key: "address",
    type: "text",
    hint: "اختیاری",
    sample: "تهران، خیابان ولیعصر",
    maxLength: 500,
  },
  {
    header: "سقف اعتبار (تومان)",
    key: "credit_limit",
    type: "money",
    hint: "حداکثر بدهی مجاز؛ خالی یعنی بدون سقف",
    sample: 0,
  },
  {
    header: "مانده اول دوره (تومان)",
    key: "opening_balance",
    type: "money",
    hint: "بدهی قبلی مثبت، طلب او منفی. اگر مطمئن نیستید خالی بگذارید",
    sample: 0,
  },
  {
    header: "توضیحات",
    key: "description",
    type: "text",
    hint: "اختیاری",
    sample: "",
    maxLength: 500,
  },
];

export const COLUMNS: Record<ImportKind, ColumnDef[]> = {
  products: PRODUCT_COLUMNS,
  contacts: CONTACT_COLUMNS,
};

export const KIND_LABEL: Record<ImportKind, string> = {
  products: "کالاها",
  contacts: "مشتریان و تأمین‌کنندگان",
};

/**
 * سقف تعداد سطر در یک فایل.
 *
 * چرا محدودیت؟ هر سطر چند کوئری می‌زند و روت‌های Vercel سقف زمان
 * دارند. ۲۰۰۰ سطر برای کوچ یک کسب‌وکار خرده‌فروشی بیش از کافی است و
 * فایل بزرگ‌تر را می‌شود تکه‌تکه فرستاد.
 */
export const MAX_ROWS = 2000;

/** سقف حجم فایل — جلوگیری از بلعیدن حافظه‌ی سرور. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/* ───────────────────── پاک‌سازی و تبدیل مقادیر ───────────────────── */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/**
 * ارقام فارسی/عربی به انگلیسی.
 *
 * 🔴 بدون این، ورودی «۱۲۵۰۰۰» که کاربر ایرانی طبیعی می‌نویسد،
 * `Number()` آن را NaN می‌کند و کل سطر رد می‌شود. جداکننده‌ی هزارگان
 * فارسی (٬) و کامای انگلیسی هم باید برداشته شوند.
 */
export function normalizeDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const fa = FA_DIGITS.indexOf(ch);
    if (fa > -1) { out += String(fa); continue; }
    const ar = AR_DIGITS.indexOf(ch);
    if (ar > -1) { out += String(ar); continue; }
    out += ch;
  }
  return out;
}

/**
 * پاک‌سازی متن یک سلول.
 *
 * نیم‌فاصله (U+200C) عمداً حفظ می‌شود — بخشی از املای درست فارسی است
 * («می‌شود» با «میشود» فرق دارد). ولی نویسه‌های جهت‌دهی نامرئی
 * (U+200E/U+200F) حذف می‌شوند: کپی از وب آن‌ها را می‌آورد و باعث
 * می‌شود دو نام ظاهراً یکسان، در مقایسه نابرابر شوند.
 */
export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[\u200E\u200F\u202A-\u202E\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** عدد صحیح؛ ورودی نامعتبر → null. */
export function parseInteger(value: unknown): number | null {
  const raw = normalizeDigits(cleanText(value)).replace(/[,٬\s]/g, "");
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/**
 * مبلغ تومان → ریال.
 *
 * ⚠️ همه‌ی مبالغ در دیتابیس ریال‌اند ولی کاربر ایرانی به تومان فکر
 * می‌کند. ستون اکسل صریحاً «(تومان)» برچسب دارد و اینجا ×۱۰ می‌شود.
 * جاافتادن این تبدیل یعنی همه‌ی قیمت‌ها یک‌دهم ثبت شوند.
 */
export function parseMoneyToRial(value: unknown): number | null {
  const toman = parseInteger(value);
  if (toman === null) return null;
  return toman * 10;
}

/**
 * موبایل ایرانی به شکل یکدست ۰۹xxxxxxxxx.
 *
 * ‎+98 و 0098 و بدون صفر ابتدایی همگی پذیرفته می‌شوند، چون در فایل
 * واقعی مشتری هر سه شکل با هم دیده می‌شود. یکدست‌سازی لازم است وگرنه
 * «۹۱۲۱۲۳۴۵۶۷» و «۰۹۱۲۱۲۳۴۵۶۷» دو مشتری جدا حساب می‌شوند.
 */
export function normalizePhone(value: unknown): string | null {
  let raw = normalizeDigits(cleanText(value)).replace(/[\s\-()]/g, "");
  if (raw === "") return null;
  if (raw.startsWith("+98")) raw = "0" + raw.slice(3);
  else if (raw.startsWith("0098")) raw = "0" + raw.slice(4);
  else if (raw.startsWith("98") && raw.length === 12) raw = "0" + raw.slice(2);
  else if (raw.startsWith("9") && raw.length === 10) raw = "0" + raw;
  if (!/^09\d{9}$/.test(raw)) return null;
  return raw;
}

/** نوع مخاطب از روی متن فارسی یا انگلیسی. */
export function parseContactType(value: unknown): "customer" | "supplier" | "both" | null {
  const raw = cleanText(value).toLowerCase();
  if (raw === "") return "customer";
  if (["مشتری", "customer", "خریدار"].includes(raw)) return "customer";
  if (["تأمین‌کننده", "تامین‌کننده", "تامین کننده", "تأمین کننده", "supplier", "فروشنده"].includes(raw))
    return "supplier";
  if (["هردو", "هر دو", "both"].includes(raw)) return "both";
  return null;
}

/**
 * کلید تطبیق برای تشخیص تکراری.
 *
 * حروف بزرگ/کوچک و فاصله نادیده گرفته می‌شوند، وگرنه «SKU-1» و
 * «sku-1 » دو کالای جدا می‌شوند.
 */
export const matchKey = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase();

/**
 * عدد با ارقام فارسی — برای متن پیام‌های خطا.
 *
 * چرا اینجا و نه import از `lib/utils/format`؟
 *   آن ماژول به dayjs و jalaliday وابسته است و این فایل باید سبک
 *   بماند تا هم در روت API و هم در تست بدون بار اضافه اجرا شود.
 *   (پیام «تکراری با سطر 2» با رقم انگلیسی، وسط متن فارسی زشت است و
 *   با بقیه‌ی اعداد صفحه که فارسی‌اند ناهماهنگ.)
 */
export function faNum(n: number): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export interface RowError {
  /** شماره‌ی سطر در فایل اکسل، همان‌طور که کاربر می‌بیند (با احتساب سرستون). */
  row: number;
  column?: string;
  message: string;
}
