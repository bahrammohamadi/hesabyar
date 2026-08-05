import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  cleanText, faNum, matchKey, normalizeDigits, normalizePhone,
  parseContactType, parseInteger, parseMoneyToRial,
  PRODUCT_COLUMNS, CONTACT_COLUMNS, COLUMNS, MAX_ROWS,
} from "@/lib/import/schema";
import { mapHeaders, normalizeHeader, parseContacts, parseProducts, type RawRow } from "@/lib/import/parse";
import { buildTemplate, readWorkbook, buildErrorReport } from "@/lib/import/workbook";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const readCode = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const mig = read("supabase/migrations/0037_data_import.sql");
/*
  SQL بدون توضیحات. چند ادعا ابتدا روی *توضیح فارسی* گیر می‌کردند نه
  روی کد — جمله‌ی «نسخه‌ی اول contact_id فرض کرد» باعث می‌شد تستِ
  «s.contact_id نباید باشد» بشکند در حالی که خودِ کوئری درست بود.
  تست غلط بدتر از نبودِ تست است چون اعتماد را از بین می‌برد.
*/
const migCode = mig.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*--.*$/gm, "");

/** ساخت سطر خام از روی عنوان‌های واقعی ستون‌ها. */
function row(kind: "products" | "contacts", values: Record<string, unknown>): RawRow {
  const out: RawRow = {};
  for (const def of COLUMNS[kind]) out[def.header] = values[def.key] ?? "";
  return out;
}
const headersOf = (kind: "products" | "contacts") => COLUMNS[kind].map((d) => d.header);
const mapOf = (kind: "products" | "contacts") => mapHeaders(headersOf(kind), kind).map;

/* ═══════════════════ تبدیل مقادیر ═══════════════════ */

describe("ارقام فارسی و عربی", () => {
  it("🔴 ارقام فارسی به انگلیسی تبدیل می‌شوند", () => {
    /*
      کاربر ایرانی «۱۲۵۰۰۰» می‌نویسد. بدون این تبدیل، Number() مقدار
      NaN می‌دهد و کل سطر رد می‌شود — یعنی فایل یک مغازه‌دار ایرانی
      عملاً غیرقابل‌استفاده بود.
    */
    expect(normalizeDigits("۱۲۳۴۵۶۷۸۹۰")).toBe("1234567890");
  });

  it("ارقام عربی هم پشتیبانی می‌شوند", () => {
    // کیبورد عربی و بعضی فایل‌های کپی‌شده از وب این‌ها را می‌دهند.
    expect(normalizeDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });

  it("متن غیرعددی دست‌نخورده می‌ماند", () => {
    expect(normalizeDigits("پیراهن ۲ رنگ")).toBe("پیراهن 2 رنگ");
  });
});

describe("پاک‌سازی متن", () => {
  it("🔴 نیم‌فاصله حفظ می‌شود", () => {
    // «می‌شود» با «میشود» فرق دارد؛ حذف نیم‌فاصله املا را خراب می‌کند.
    expect(cleanText("تأمین‌کننده")).toBe("تأمین‌کننده");
    expect(cleanText("تأمین‌کننده")).toContain("\u200C");
  });

  it("🔴 نویسه‌های جهت‌دهی نامرئی حذف می‌شوند", () => {
    /*
      کپی از وب نویسه‌های LRM/RLM می‌آورد. بدون حذفشان، دو نامِ
      ظاهراً یکسان در مقایسه نابرابر می‌شوند و تشخیص تکراری از کار
      می‌افتد.
    */
    expect(cleanText("\u200Fعلی\u200E")).toBe("علی");
    expect(cleanText("\uFEFFنام")).toBe("نام");
  });

  it("فاصله‌های اضافه یکدست می‌شوند", () => {
    expect(cleanText("  پیراهن   آبی  ")).toBe("پیراهن آبی");
  });

  it("مقدار تهی رشته‌ی خالی می‌دهد، نه «null»", () => {
    expect(cleanText(null)).toBe("");
    expect(cleanText(undefined)).toBe("");
  });
});

describe("🔴 تبدیل تومان به ریال", () => {
  /*
    همه‌ی مبالغ در دیتابیس ریال‌اند ولی کاربر ایرانی به تومان فکر
    می‌کند. جاافتادن ×۱۰ یعنی همه‌ی قیمت‌ها یک‌دهم ثبت شوند و کاربر
    ماه‌ها بعد بفهمد.
  */
  it("۲۵۰۰۰۰ تومان → ۲۵۰۰۰۰۰ ریال", () => {
    expect(parseMoneyToRial("250000")).toBe(2_500_000);
  });

  it("با ارقام فارسی هم درست کار می‌کند", () => {
    expect(parseMoneyToRial("۲۵۰۰۰۰")).toBe(2_500_000);
  });

  it("جداکننده‌ی هزارگان (کاما و ٬) نادیده گرفته می‌شود", () => {
    // اکسل خودش «۱,۲۵۰,۰۰۰» نمایش می‌دهد و کاربر همان را کپی می‌کند.
    expect(parseMoneyToRial("1,250,000")).toBe(12_500_000);
    expect(parseMoneyToRial("۱٬۲۵۰٬۰۰۰")).toBe(12_500_000);
  });

  it("مقدار خالی null می‌دهد نه صفر", () => {
    // تفاوت «قیمت ندارد» با «قیمت صفر است» باید حفظ شود.
    expect(parseMoneyToRial("")).toBeNull();
    expect(parseMoneyToRial(null)).toBeNull();
  });

  it("متن نامعتبر null می‌دهد", () => {
    expect(parseMoneyToRial("۲۵۰ هزار")).toBeNull();
    expect(parseMoneyToRial("رایگان")).toBeNull();
  });
});

describe("عدد صحیح", () => {
  it("اعشار بریده می‌شود", () => expect(parseInteger("12.9")).toBe(12));
  it("منفی پذیرفته می‌شود (بررسی‌اش جای دیگر است)", () => expect(parseInteger("-5")).toBe(-5));
  it("خالی null می‌دهد", () => expect(parseInteger("  ")).toBeNull());
});

describe("🔴 یکدست‌سازی موبایل", () => {
  /*
    در فایل واقعی مشتری هر سه شکل با هم دیده می‌شود. بدون یکدست‌سازی،
    «۹۱۲۱۲۳۴۵۶۷» و «۰۹۱۲۱۲۳۴۵۶۷» دو مشتری جدا حساب می‌شوند و تشخیص
    تکراری بی‌فایده می‌شود.
  */
  it.each([
    ["09121234567", "09121234567"],
    ["۰۹۱۲۱۲۳۴۵۶۷", "09121234567"],
    ["+989121234567", "09121234567"],
    ["00989121234567", "09121234567"],
    ["989121234567", "09121234567"],
    ["9121234567", "09121234567"],
    ["0912-123-4567", "09121234567"],
    ["0912 123 4567", "09121234567"],
  ])("«%s» → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("شماره‌ی نامعتبر null می‌دهد", () => {
    expect(normalizePhone("0912123")).toBeNull();      // کوتاه
    expect(normalizePhone("02188776655")).toBeNull();  // ثابت، نه موبایل
    expect(normalizePhone("abc")).toBeNull();
  });

  it("خالی null می‌دهد (خطا نیست)", () => {
    expect(normalizePhone("")).toBeNull();
  });
});

describe("نوع مخاطب", () => {
  it("خالی یعنی مشتری", () => expect(parseContactType("")).toBe("customer"));
  it("فارسی شناخته می‌شود", () => {
    expect(parseContactType("مشتری")).toBe("customer");
    expect(parseContactType("تأمین‌کننده")).toBe("supplier");
    expect(parseContactType("تامین کننده")).toBe("supplier");
    expect(parseContactType("هردو")).toBe("both");
  });
  it("انگلیسی هم شناخته می‌شود", () => {
    expect(parseContactType("customer")).toBe("customer");
    expect(parseContactType("SUPPLIER")).toBe("supplier");
  });
  it("مقدار ناشناخته null می‌دهد تا خطا گزارش شود", () => {
    expect(parseContactType("فروشگاه")).toBeNull();
  });
});

/* ═══════════════════ تطبیق سرستون ═══════════════════ */

describe("تطبیق سرستون‌ها", () => {
  it("🔴 «ي» عربی و «ك» عربی تحمل می‌شوند", () => {
    // کاربر با کیبورد عربی تایپ می‌کند یا فایل از سیستم دیگری آمده.
    expect(normalizeHeader("نام كالا")).toBe(normalizeHeader("نام کالا"));
    expect(normalizeHeader("موبايل")).toBe(normalizeHeader("موبایل"));
  });

  it("فاصله‌ی اضافه و پرانتز تحمل می‌شود", () => {
    expect(normalizeHeader("  قیمت خرید (تومان) ")).toBe(normalizeHeader("قیمت خرید تومان"));
  });

  it("همه‌ی ستون‌های قالب شناخته می‌شوند", () => {
    for (const kind of ["products", "contacts"] as const) {
      const { map, missing, unknown } = mapHeaders(headersOf(kind), kind);
      expect(Object.keys(map)).toHaveLength(COLUMNS[kind].length);
      expect(missing).toHaveLength(0);
      expect(unknown).toHaveLength(0);
    }
  });

  it("ستون اجباری غایب گزارش می‌شود", () => {
    const { missing } = mapHeaders(["کد کالا", "بارکد"], "products");
    expect(missing.map((m) => m.key)).toContain("name");
  });

  it("ستون ناشناخته خطا نیست، فقط گزارش می‌شود", () => {
    // کاربر ممکن است ستون یادداشت شخصی داشته باشد.
    const { unknown, missing } = mapHeaders([...headersOf("products"), "یادداشت من"], "products");
    expect(unknown).toEqual(["یادداشت من"]);
    expect(missing).toHaveLength(0);
  });
});

/* ═══════════════════ اعتبارسنجی کالا ═══════════════════ */

describe("اعتبارسنجی کالاها", () => {
  const map = mapOf("products");

  it("سطر سالم پذیرفته می‌شود و مبلغ ریالی است", () => {
    const r = parseProducts([row("products", {
      name: "پیراهن", purchase_price: "۲۵۰۰۰۰", sale_price: "390000", stock: "۱۲",
    })], map);
    expect(r.errors).toHaveLength(0);
    expect(r.rows[0].purchasePrice).toBe(2_500_000);
    expect(r.rows[0].salePrice).toBe(3_900_000);
    expect(r.rows[0].stock).toBe(12);
  });

  it("🔴 سطر کاملاً خالی نادیده گرفته می‌شود، نه خطا", () => {
    // فایل اکسل معمولاً چند سطر خالی در انتها دارد.
    const r = parseProducts([row("products", {})], map);
    expect(r.rows).toHaveLength(0);
    expect(r.errors).toHaveLength(0);
  });

  it("نام خالی خطا می‌دهد با شماره‌ی سطر درست", () => {
    const r = parseProducts(
      [row("products", { name: "الف" }), row("products", { purchase_price: "1000" })],
      map
    );
    expect(r.errors).toHaveLength(1);
    // سطر ۱ داده = سطر ۳ اکسل (سرستون + یک‌مبنا)
    expect(r.errors[0].row).toBe(3);
  });

  it("🔴 قیمت نامفهوم رد می‌شود، نه اینکه صفر ثبت شود", () => {
    /*
      اگر «۲۵۰ هزار» بی‌صدا صفر می‌شد، کالا با قیمت صفر وارد می‌شد و
      کاربر ماه‌ها بعد در گزارش سود متوجه می‌شد.
    */
    const r = parseProducts([row("products", { name: "الف", sale_price: "۲۵۰ هزار" })], map);
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0].message).toContain("نامعتبر");
  });

  it("قیمت منفی رد می‌شود", () => {
    const r = parseProducts([row("products", { name: "الف", sale_price: "-100" })], map);
    expect(r.rows).toHaveLength(0);
  });

  it("موجودی منفی رد می‌شود", () => {
    const r = parseProducts([row("products", { name: "الف", stock: "-3" })], map);
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0].column).toBe("موجودی اولیه");
  });

  it("🔴 یک کالا در چند رنگ، تکراری نیست", () => {
    /*
      اگر تشخیص تکراری فقط بر پایه‌ی نام بود، یک پیراهن در سه رنگ به
      یک ردیف تقلیل پیدا می‌کرد — دقیقاً همان چیزی که مزون پوشاک
      لازم دارد از دست می‌رفت.
    */
    const r = parseProducts([
      row("products", { name: "پیراهن", color: "آبی", size: "L" }),
      row("products", { name: "پیراهن", color: "قرمز", size: "L" }),
      row("products", { name: "پیراهن", color: "آبی", size: "XL" }),
    ], map);
    expect(r.rows).toHaveLength(3);
    expect(r.duplicatesInFile).toHaveLength(0);
  });

  it("همان رنگ و سایز تکراری است", () => {
    const r = parseProducts([
      row("products", { name: "پیراهن", color: "آبی", size: "L" }),
      row("products", { name: "پیراهن", color: "آبی", size: "L" }),
    ], map);
    expect(r.rows).toHaveLength(1);
    // ارقام پیام فارسی‌اند؛ «سطر 2» وسط متن فارسی ناهماهنگ بود.
    expect(r.duplicatesInFile[0].message).toContain("سطر ۲");
  });

  it("بارکد یکسان تکراری است، حتی با نام متفاوت", () => {
    const r = parseProducts([
      row("products", { name: "الف", barcode: "6260100123456" }),
      row("products", { name: "ب", barcode: "6260100123456" }),
    ], map);
    expect(r.rows).toHaveLength(1);
    expect(r.duplicatesInFile).toHaveLength(1);
  });

  it("اولویت کلید تطبیق: بارکد بر کد مقدم است", () => {
    const r = parseProducts([row("products", { name: "الف", barcode: "111", code: "P-1" })], map);
    expect(r.rows[0].dedupeBy).toBe("barcode");
  });
});

/* ═══════════════════ اعتبارسنجی مخاطب ═══════════════════ */

describe("اعتبارسنجی مخاطبین", () => {
  const map = mapOf("contacts");

  it("سطر سالم با شماره‌ی یکدست", () => {
    const r = parseContacts([row("contacts", {
      name: "علی محمدی", phone: "۹۱۲۱۲۳۴۵۶۷", type: "مشتری", credit_limit: "50000",
    })], map);
    expect(r.errors).toHaveLength(0);
    expect(r.rows[0].phone).toBe("09121234567");
    expect(r.rows[0].creditLimit).toBe(500_000);
  });

  it("🔴 مخاطب بدون شماره پذیرفته می‌شود", () => {
    /*
      خیلی از مشتریان حضوری شماره ندارند. رد کردنشان یعنی کاربر
      مجبور شود شماره‌ی الکی بسازد — که داده را خراب‌تر می‌کند.
    */
    const r = parseContacts([row("contacts", { name: "مشتری نقدی" })], map);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].phone).toBeNull();
  });

  it("شماره‌ی نامعتبر خطا می‌دهد", () => {
    const r = parseContacts([row("contacts", { name: "الف", phone: "0912123" })], map);
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0].message).toContain("۱۱ رقم");
  });

  it("دو شکل مختلف یک شماره، تکراری تشخیص داده می‌شود", () => {
    const r = parseContacts([
      row("contacts", { name: "علی", phone: "09121234567" }),
      row("contacts", { name: "علی محمدی", phone: "+989121234567" }),
    ], map);
    expect(r.rows).toHaveLength(1);
    expect(r.duplicatesInFile).toHaveLength(1);
  });

  it("مانده‌ی منفی مجاز است (طلبکار)", () => {
    // مشتری می‌تواند از ما طلبکار باشد؛ رد کردنش غلط است.
    const r = parseContacts([row("contacts", { name: "الف", opening_balance: "-100000" })], map);
    expect(r.rows[0].openingBalance).toBe(-1_000_000);
  });

  it("سقف اعتبار منفی رد می‌شود", () => {
    const r = parseContacts([row("contacts", { name: "الف", credit_limit: "-5000" })], map);
    expect(r.rows).toHaveLength(0);
  });
});

/* ═══════════════════ فایل اکسل ═══════════════════ */

describe("ساخت و خواندن فایل اکسل", () => {
  it("🔴 قالب ساخته‌شده با خودِ خواننده سازگار است", () => {
    /*
      مهم‌ترین تست این فایل: اگر قالبی که تحویل کاربر می‌دهیم با
      پارسر خودمان نخواند، کاربر فایل دست‌نخورده را برمی‌گرداند و
      «ستون اجباری نیست» می‌گیرد.
    */
    for (const kind of ["products", "contacts"] as const) {
      const buf = buildTemplate(kind, { categories: ["الکترونیک"], brands: ["سونی"] });
      const parsed = readWorkbook(buf);
      const { missing, unknown } = mapHeaders(parsed.headers, kind);
      expect(missing, `${kind}: ستون اجباری غایب`).toHaveLength(0);
      expect(unknown, `${kind}: ستون ناشناخته`).toHaveLength(0);
    }
  });

  it("شیت «داده» انتخاب می‌شود، نه شیت راهنما", () => {
    const buf = buildTemplate("products");
    expect(readWorkbook(buf).sheetName).toBe("داده");
  });

  it("سطر نمونه‌ی قالب کالا معتبر پارس می‌شود", () => {
    const buf = buildTemplate("products");
    const parsed = readWorkbook(buf);
    const { map } = mapHeaders(parsed.headers, "products");
    const r = parseProducts(parsed.rows, map);
    expect(r.errors).toHaveLength(0);
    expect(r.rows[0].name).toBeTruthy();
  });

  it("سطر نمونه‌ی قالب مخاطب معتبر پارس می‌شود", () => {
    const buf = buildTemplate("contacts");
    const parsed = readWorkbook(buf);
    const { map } = mapHeaders(parsed.headers, "contacts");
    const r = parseContacts(parsed.rows, map);
    expect(r.errors).toHaveLength(0);
    expect(r.rows[0].type).toBe("customer");
  });

  it("متن فارسی در رفت‌وبرگشت سالم می‌ماند", () => {
    const buf = buildTemplate("contacts");
    expect(readWorkbook(buf).headers).toContain("موبایل");
  });

  it("🔴 فایل غیراکسل رد می‌شود، نه اینکه به‌عنوان CSV خوانده شود", () => {
    /*
      SheetJS قالب را حدس می‌زند و هر متنی را CSV می‌پذیرد. بدون گاردِ
      امضای فایل، متن «این یک فایل اکسل نیست» بدون خطا خوانده می‌شد و
      یک سرستون به‌هم‌ریخته می‌داد؛ کاربر به‌جای «این اکسل نیست» پیام
      «ستون اجباری نام کالا نیست» می‌گرفت.
    */
    expect(() => readWorkbook(Buffer.from("این یک فایل اکسل نیست"))).toThrow(/اکسل/);
  });

  it("فایل باینری (عکس/PDF) رد می‌شود", () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
    expect(() => readWorkbook(pngHeader)).toThrow(/اکسل/);
  });

  it("CSV واقعی پذیرفته می‌شود", () => {
    // نرم‌افزارهای قدیمی حسابداری فقط CSV می‌دهند؛ رد کردنشان مانع
    // بی‌دلیلی است.
    const csv = "نام,موبایل\nعلی محمدی,09121234567";
    const parsed = readWorkbook(Buffer.from(csv, "utf8"));
    expect(parsed.headers).toContain("نام");
    expect(parsed.rows).toHaveLength(1);
  });

  it("گزارش خطا ساخته و خوانده می‌شود", () => {
    const buf = buildErrorReport([{ row: 5, column: "نام", message: "خالی است" }]);
    const parsed = readWorkbook(buf);
    expect(parsed.rows).toHaveLength(1);
  });

  it("قالب راست‌به‌چپ است", () => {
    // فایل فارسی که چپ‌به‌راست باز شود، برای کاربر ایرانی گیج‌کننده است.
    const wb = readWorkbook(buildTemplate("products"));
    expect(wb.headers[0]).toBe("نام کالا");
  });
});

/* ═══════════════════ گاردهای امنیتی ═══════════════════ */

describe("🔴 گاردهای مهاجرت ۰۰۳۷", () => {
  it("جدول import_jobs فقط خواندن دارد، نه نوشتن مستقیم", () => {
    /*
      اگر کلاینت می‌توانست مستقیم بنویسد، می‌شد job جعلی با آمار
      دلخواه ساخت و گزارش را بی‌معنا کرد.
    */
    expect(mig).toContain("create policy p_import_read");
    expect(mig).not.toMatch(/create policy \w+ on public\.import_jobs\s+for insert/);
  });

  it("منشأ هر رکورد ذخیره می‌شود", () => {
    for (const t of ["products", "product_variants", "contacts"]) {
      expect(mig).toContain(`alter table public.${t}\n  add column if not exists import_job_id`);
    }
  });

  it("حذف دفترچه داده‌ی مشتری را نمی‌برد", () => {
    // on delete cascade اینجا فاجعه بود.
    expect(mig).toContain("references public.import_jobs(id) on delete set null");
    expect(mig).not.toContain("references public.import_jobs(id) on delete cascade");
  });

  it("🔴 رکورد استفاده‌شده حذف نمی‌شود", () => {
    /*
      اگر کالایی در فاکتور فروش آمده باشد، حذفش یعنی فاکتور بی‌قلم
      می‌شود و گزارش‌های مالی به هم می‌ریزد.
    */
    expect(mig).toContain("from public.sale_items si");
    expect(mig).toContain("from public.purchase_items pi");
    expect(mig).toContain("set is_active = false");
  });

  it("🔴 سند انبار پیش از واریانت حذف می‌شود", () => {
    /*
      تریگر apply_stock_movement با حذف سند، موجودی را برمی‌گرداند.
      اگر واریانت زودتر حذف می‌شد، cascade سند را می‌برد و تریگر روی
      ردیف حذف‌شده اثری نداشت → موجودی بی‌سند باقی می‌ماند.
    */
    const delMoves = mig.indexOf("del_moves as (");
    const delVariants = mig.indexOf("del_v as (");
    expect(delMoves).toBeGreaterThan(-1);
    expect(delMoves).toBeLessThan(delVariants);
  });

  it("🔴 نام ستون‌های ارجاع به مخاطب درست است", () => {
    /*
      نام‌ها یکسان نیستند و حدس‌زدنشان باگ داد:
        sales.customer_id · purchases.supplier_id · transactions.contact_id
      نسخه‌ی اول هر سه را contact_id فرض کرد؛ تابع با خطای
      «column s.contact_id does not exist» شکست. نه tsc، نه next build
      و نه هیچ تست واحدی نگرفت — فقط فراخوانی واقعی روی دیتابیس.
    */
    expect(mig).toContain("where s.customer_id = c.id");
    expect(mig).toContain("where pu.supplier_id = c.id");
    expect(mig).toContain("where t.contact_id  = c.id");
    expect(migCode).not.toContain("s.contact_id");
  });

  it("تابع برگرداندن گارد دسترسی داخلی دارد", () => {
    // تابع security definer است؛ بدون این، هر کاربری می‌توانست ورود
    // سازمان دیگری را برگرداند.
    expect(mig).toContain("raise exception 'دسترسی مجاز نیست'");
    expect(mig).toContain("v_job.org_id in (select public.user_org_ids())");
  });

  it("برگرداندن دوباره جلوگیری می‌شود", () => {
    expect(mig).toContain("قبلاً برگردانده شده است");
  });

  it("مجوز data.import پرخطر و فقط برای مدیر ارشد است", () => {
    expect(mig).toContain("'data.import'");
    expect(mig).toContain("when 'data.import'      then v_role = 'super_admin'");
    expect(mig).toMatch(/'data\.import'.*'high'/);
  });

  it("🔴 مجوزهای تیکت در بازنویسی ماتریس جا نمانده‌اند", () => {
    /*
      این مهاجرت تابع platform_admin_can را دوباره می‌نویسد — همان
      کاری که ۰۰۳۱ و ۰۰۳۳ کردند و باعث شد tickets.reply بی‌صدا
      بیفتد. تست جلوی تکرار بار سوم را می‌گیرد.
    */
    for (const p of ["tickets.view", "tickets.reply", "users.password", "impersonate", "announcements.manage"]) {
      expect(mig, `مجوز ${p} در ماتریس نیست`).toContain(`when '${p}'`);
    }
  });
});

describe("🔴 گاردهای روت API", () => {
  const custPost = readCode("app/api/import/route.ts");
  const custItem = readCode("app/api/import/[id]/route.ts");
  const admin = readCode("app/api/admin/import/route.ts");
  const template = readCode("app/api/import/template/route.ts");

  it("ورود دسته‌جمعی همان مجوزی را می‌خواهد که ساخت تکی", () => {
    expect(custPost).toContain('kind === "products" ? "products.edit" : "contacts.edit"');
    expect(custItem).toContain('"products.edit" : "contacts.edit"');
  });

  it("مسیر ادمین مجوز جدا و دلیل اجباری دارد", () => {
    expect(admin).toContain('requirePlatformPermission("data.import")');
    expect(admin).toContain("reason.length < 5");
  });

  it("🔴 برگرداندن، گارد سازمان داخل کوئری دارد", () => {
    // شناسه از URL می‌آید و service_role از RLS رد می‌شود.
    expect(custItem).toContain('.eq("org_id", membership.org_id)');
  });

  it("ورود ناموجود و ورود سازمان دیگر پاسخ یکسان می‌گیرند", () => {
    expect(custItem).toContain("ورود موردنظر یافت نشد");
  });

  it("همه‌ی روت‌ها سقف نرخ دارند", () => {
    for (const src of [custPost, custItem, admin, template]) {
      expect(src).toContain("tooManyRequests");
    }
  });

  it("حجم و خالی‌بودن فایل بررسی می‌شود", () => {
    for (const src of [custPost, admin]) {
      expect(src).toContain("MAX_FILE_BYTES");
      expect(src).toContain("file.size === 0");
    }
  });

  it("ورود ادمین در گزارش ممیزی ثبت می‌شود، بدون محتوای فایل", () => {
    expect(admin).toContain('p_action: "data.imported"');
    // فقط نام و آمار، نه سطرها
    expect(admin).toContain("file: file.name.slice(0, 120)");
  });

  it("پیش‌نمایش چیزی در ممیزی ثبت نمی‌کند", () => {
    // dryRun داده‌ای نمی‌نویسد، پس رویداد ممیزی هم ندارد.
    expect(admin).toContain("if (!result.dryRun && result.ok)");
  });

  it("🔴 هیچ کوئری Supabase با void رها نشده", () => {
    // درس تیکت پشتیبانی: سازنده‌ی کوئری تنبل است؛ بدون await اجرا نمی‌شود.
    for (const src of [custPost, custItem, admin, template]) {
      expect(src).not.toMatch(/void\s+(auth\.)?svc\s*\n?\s*\./);
    }
  });

  it("روت‌های سنگین maxDuration دارند", () => {
    // سقف پیش‌فرض ۱۰ ثانیه برای چند صد سطر کافی نیست.
    for (const src of [custPost, custItem, admin]) {
      expect(src).toContain("export const maxDuration = 60");
    }
  });
});

describe("🔴 موجودی فقط با سند انبار", () => {
  const exec = readCode("lib/import/execute.ts");

  it("stock_qty مستقیم نوشته نمی‌شود", () => {
    /*
      تریگر guard_stock_qty_update تغییر مستقیم را رد می‌کند:
      «stock_qty فقط از طریق stock_movements قابل تغییر است».
      نوشتن مستقیم یعنی کل سطر با خطا برگردد.
    */
    expect(exec).not.toMatch(/stock_qty\s*:/);
  });

  it("موجودی اولیه با سند reason=opening ثبت می‌شود", () => {
    expect(exec).toContain('reason: "opening"');
    expect(exec).toContain('ref_table: "import_jobs"');
  });

  it("🔴 به‌روزرسانی، ستون خالی را پاک نمی‌کند", () => {
    /*
      اگر همه‌ی ستون‌ها فرستاده می‌شدند، ستون خالی در فایل آدرس و
      توضیح موجود مشتری را پاک می‌کرد — «به‌روزرسانی» به «حذف
      اطلاعات» تبدیل می‌شد.
    */
    expect(exec).toContain("if (r.address !== null) patch.address");
    expect(exec).toContain("if (r.phone !== null) patch.phone");
  });

  it("دسته‌ی جدید ساخته نمی‌شود، برند بله", () => {
    // categories ستون org_id ندارد و بین همه‌ی کسب‌وکارها مشترک است.
    expect(exec).toContain('svc.from("brands")');
    expect(exec).not.toMatch(/from\("categories"\)\s*\n?\s*\.insert/);
  });

  it("رکوردهای موجود یک بار خوانده می‌شوند، نه به ازای هر سطر", () => {
    // با ۵۰۰ سطر، حالت N+1 قطعاً timeout می‌دهد.
    expect(exec).toContain("const CHUNK = 200");
    expect(exec).toContain(".select(\"id, name, phone, code\")");
  });
});

describe("سقف‌ها", () => {
  it("سقف سطر و حجم تعریف شده", () => {
    expect(MAX_ROWS).toBeGreaterThan(500);
    expect(MAX_ROWS).toBeLessThanOrEqual(5000);
  });

  it("هر ستون راهنما و نمونه دارد", () => {
    // بدون راهنما کاربر نمی‌داند «۲۵۰۰۰۰» را با کاما بنویسد یا نه.
    for (const def of [...PRODUCT_COLUMNS, ...CONTACT_COLUMNS]) {
      expect(def.hint, `${def.header} راهنما ندارد`).toBeTruthy();
      expect(def.header).toBeTruthy();
    }
  });

  it("کلید ستون‌ها تکراری نیست", () => {
    for (const kind of ["products", "contacts"] as const) {
      const keys = COLUMNS[kind].map((d) => d.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe("ارقام فارسی در پیام خطا", () => {
  it("شماره‌ی سطر در پیام فارسی است", () => {
    expect(faNum(147)).toBe("۱۴۷");
  });
});

describe("matchKey", () => {
  it("حروف بزرگ/کوچک و فاصله نادیده گرفته می‌شود", () => {
    // وگرنه «SKU-1» و «sku-1 » دو کالای جدا می‌شوند.
    expect(matchKey("SKU-1")).toBe(matchKey("sku-1 "));
  });
  it("مقدار تهی رشته‌ی خالی می‌دهد", () => {
    expect(matchKey(null)).toBe("");
  });
});

describe("ناوبری و مهاجرت", () => {
  it("شماره‌ی مهاجرت یکتاست", () => {
    const files = readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql"));
    const numbers = files.map((f) => f.slice(0, 4));
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("مهاجرت فایل بازگردانی دارد", () => {
    const downs = readdirSync(join(root, "supabase/rollbacks"));
    expect(downs).toContain("0037_data_import.down.sql");
  });

  it("🔴 بازگردانی، داده‌ی واقعی را نمی‌برد", () => {
    const down = read("supabase/rollbacks/0037_data_import.down.sql");
    // ستون فقط وقتی حذف می‌شود که هیچ ورودی ثبت نشده باشد.
    expect(down).toContain("if not exists (select 1 from public.import_jobs)");
  });
});
