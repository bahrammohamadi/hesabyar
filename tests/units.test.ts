import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  allowsFraction,
  baseToPack,
  formatQty,
  lineTotalRial,
  normalizeQty,
  packPriceToUnitPrice,
  packToBase,
  unitLabel,
  validateQty,
  UNIT_KINDS,
  UNIT_META,
} from "@/lib/units";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
/*
  ⚠️ تله‌ی تکراری: ادعاهای تست روی *توضیحات فارسی* گیر می‌کنند نه کد.
*/
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*(\/\/|--).*$/gm, "");

describe("واحد شمارش", () => {
  it("فقط کالای شمارشی اعشار نمی‌پذیرد", () => {
    expect(allowsFraction("count")).toBe(false);
    expect(allowsFraction("weight")).toBe(true);
    expect(allowsFraction("volume")).toBe(true);
    expect(allowsFraction("length")).toBe(true);
  });

  it("هر نوع واحد برچسب و پیش‌فرض دارد", () => {
    for (const k of UNIT_KINDS) {
      expect(UNIT_META[k].label.length).toBeGreaterThan(0);
      expect(UNIT_META[k].defaultUnit.length).toBeGreaterThan(0);
    }
  });

  it("برچسب دلخواه کاربر بر پیش‌فرض مقدم است", () => {
    expect(unitLabel("weight")).toBe("کیلوگرم");
    expect(unitLabel("weight", "گرم")).toBe("گرم");
    // فاصله‌ی خالی برچسب نیست
    expect(unitLabel("count", "   ")).toBe("عدد");
    expect(unitLabel("count", null)).toBe("عدد");
  });
});

describe("گرد کردن مقدار", () => {
  /*
    🔴 کالای شمارشی نباید ۲٫۵ عدد بپذیرد. اگر نگیریمش، «۲٫۵ عدد
    پیراهن» ثبت می‌شود و انبار برای همیشه نیم‌عددی می‌ماند.
  */
  it("کالای شمارشی به عدد صحیح گرد می‌شود", () => {
    expect(normalizeQty(2.5, "count")).toBe(3);
    expect(normalizeQty(2.4, "count")).toBe(2);
    expect(normalizeQty(7, "count")).toBe(7);
  });

  it("کالای وزنی سه رقم اعشار نگه می‌دارد", () => {
    expect(normalizeQty(1.5, "weight")).toBe(1.5);
    expect(normalizeQty(0.25, "weight")).toBe(0.25);
    expect(normalizeQty(1.2345, "weight")).toBe(1.235);
  });

  it("مقدار منفی صفر می‌شود نه منفی", () => {
    expect(normalizeQty(-5, "weight")).toBe(0);
    expect(normalizeQty(-5, "count")).toBe(0);
  });

  it("ورودی خراب صفر می‌شود نه NaN", () => {
    expect(normalizeQty(NaN, "weight")).toBe(0);
    expect(normalizeQty(Infinity, "count")).toBe(0);
  });

  /*
    🔴 خطای ممیز شناور: 0.1 + 0.2 = 0.30000000000000004
    گرد کردن باید بدون این خطا انجام شود.
  */
  it("خطای ممیز شناور وارد نتیجه نمی‌شود", () => {
    expect(normalizeQty(0.1 + 0.2, "weight")).toBe(0.3);
    expect(normalizeQty(2.675, "weight")).toBe(2.675);
  });
});

describe("اعتبارسنجی مقدار", () => {
  it("مقدار درست خطا ندارد", () => {
    expect(validateQty(3, "count")).toBeNull();
    expect(validateQty(1.5, "weight")).toBeNull();
  });

  it("صفر و منفی رد می‌شوند", () => {
    expect(validateQty(0, "weight")).not.toBeNull();
    expect(validateQty(-1, "count")).not.toBeNull();
  });

  it("اعشار روی کالای شمارشی رد می‌شود", () => {
    expect(validateQty(2.5, "count")).toMatch(/شمارشی/);
  });

  it("بیش از سه رقم اعشار رد می‌شود", () => {
    expect(validateQty(1.2345, "weight")).toMatch(/سه رقم/);
  });
});

describe("واحد فرعی (بسته / کارتن)", () => {
  it("سه کارتن دوازده‌تایی می‌شود سی‌وشش عدد", () => {
    expect(packToBase(3, 12)).toBe(36);
  });

  /*
    🔴 بسته‌ی تعریف‌نشده ضریب یک دارد نه صفر. اگر صفر برمی‌گرداندیم،
    کاربری که «۳ کارتن» زده ناگهان صفر عدد در فاکتور می‌دید.
  */
  it("بسته‌ی تعریف‌نشده ضریب یک دارد نه صفر", () => {
    expect(packToBase(3, null)).toBe(3);
    expect(packToBase(3, 0)).toBe(3);
    expect(packToBase(3, undefined)).toBe(3);
  });

  it("بسته‌ی اعشاری هم کار می‌کند", () => {
    expect(packToBase(2, 1.5)).toBe(3);
  });

  it("تبدیل معکوس برمی‌گرداند", () => {
    expect(baseToPack(36, 12)).toBe(3);
    expect(baseToPack(36, null)).toBe(36);
  });

  /*
    🔴 تأمین‌کننده «کارتن ۱۲تایی، ۲۴۰ هزار تومان» می‌دهد. اگر همان
    ۲۴۰ هزار را قیمت واحد بگیریم، بهای تمام‌شده ۱۲ برابر می‌شود و
    گزارش سود کاملاً غلط می‌شود.
  */
  it("قیمت بسته به قیمت واحد تبدیل می‌شود", () => {
    expect(packPriceToUnitPrice(2_400_000, 12)).toBe(200_000);
  });

  it("قیمت بسته بدون اندازه‌ی بسته دست نمی‌خورد", () => {
    expect(packPriceToUnitPrice(2_400_000, null)).toBe(2_400_000);
  });

  it("تقسیم غیررند گرد می‌شود نه اعشاری بماند", () => {
    // ریال واحد صحیح است؛ کسر ریال معنا ندارد.
    expect(Number.isInteger(packPriceToUnitPrice(1000, 3))).toBe(true);
  });
});

describe("نمایش مقدار", () => {
  it("صفرهای انتهایی حذف می‌شوند", () => {
    expect(formatQty(1.5, "weight")).toBe("1.5");
    expect(formatQty(2, "weight")).toBe("2");
    expect(formatQty(1.25, "weight")).toBe("1.25");
  });

  it("کالای شمارشی اعشار نشان نمی‌دهد", () => {
    expect(formatQty(3, "count")).toBe("3");
    expect(formatQty(3.4, "count")).toBe("3");
  });
});

describe("مبلغ سطر با مقدار اعشاری", () => {
  /*
    🔴 ضرب اعشاری در جاوااسکریپت عدد صحیح نمی‌دهد. اندازه‌گیری شده:
        10000 × 0.07  = 700.0000000000001
       100000 × 1.15  = 114999.99999999999
        12345 × 0.3   = 3703.5
    بدون گرد کردن صریح، این اعداد در `sale_items.line_total` که
    `bigint` است می‌نشینند و جمع فاکتور با جمع سطرها اختلاف پیدا
    می‌کند — کاربر فکر می‌کند برنامه حساب بلد نیست.
  */
  it("خطای ممیز شناور در مبلغ ظاهر نمی‌شود", () => {
    // هر سه بدون گرد کردن، عدد غیرصحیح می‌دادند.
    expect(lineTotalRial(10_000, 0.07, "weight")).toBe(700);
    expect(lineTotalRial(100_000, 1.15, "weight")).toBe(115_000);
    expect(lineTotalRial(12_345, 0.3, "weight")).toBe(3_704);

    for (const [price, qty] of [[10_000, 0.07], [100_000, 1.15], [12_345, 0.3], [999, 0.001]] as const) {
      expect(Number.isInteger(lineTotalRial(price, qty, "weight"))).toBe(true);
    }
  });

  it("مقدار وزنی درست ضرب می‌شود", () => {
    expect(lineTotalRial(100_000, 2.5, "weight")).toBe(250_000);
    expect(lineTotalRial(100_000, 0.25, "weight")).toBe(25_000);
  });

  it("کالای شمارشی با مقدار اعشاری اول گرد می‌شود", () => {
    expect(lineTotalRial(100_000, 2.4, "count")).toBe(200_000);
  });

  it("قیمت منفی صفر حساب می‌شود", () => {
    expect(lineTotalRial(-100, 2, "count")).toBe(0);
  });
});

describe("همسانی با مهاجرت ۰۰۴۸", () => {
  const sql = readCode("supabase/migrations/0048_units_and_weight.sql");

  it("ستون واحد با محدودیت مقدار اضافه شده", () => {
    expect(sql).toMatch(/add column if not exists unit text/);
    expect(sql).toMatch(/check \(unit in \('count','weight','volume','length'\)\)/);
  });

  /*
    🔴 numeric و نه float. ممیز شناور برای مقدار و پول سم است:
    جمع موجودی بعد از هزار حرکت با واقعیت فرق می‌کند.
  */
  it("ستون‌های مقدار به numeric تبدیل شده‌اند نه float", () => {
    for (const t of [
      "stock_movements", "sale_items", "purchase_items",
      "sales_return_items", "purchase_return_items",
      "sales_order_items", "purchase_order_items",
    ]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${t}\\s+alter column qty type numeric\\(14,3\\)`));
    }
    expect(sql).not.toMatch(/type (float|double precision|real)/);
  });

  /*
    🔴 stock_qty هم باید numeric شود وگرنه جمع حرکت‌های اعشاری هنگام
    نوشتن روی آن گرد می‌شود و موجودی با کاردکس نمی‌خواند.
  */
  it("موجودی کالا هم numeric شده", () => {
    expect(sql).toMatch(/alter table public\.product_variants\s+alter column stock_qty type numeric\(14,3\)/);
  });

  /*
    🔴 حیاتی‌ترین ادعای این فایل.

    ۱۱ نما drop و بازساخته می‌شوند. چهارتاشان security_invoker دارند
    و اگر آن گزینه از قلم بیفتد، RLS دور زده می‌شود و هر کاربر
    داده‌ی سازمان‌های دیگر را می‌بیند.
  */
  it("نماهای security_invoker با همان گزینه بازساخته می‌شوند", () => {
    for (const v of ["v_document_lines", "v_monthly_profit", "v_product_profitability", "v_product_stock"]) {
      expect(sql).toMatch(
        new RegExp(`create view public\\.${v}\\s*\\n?\\s*with \\(security_invoker = true\\)`)
      );
    }
  });

  it("هر نمای حذف‌شده دوباره ساخته می‌شود", () => {
    const dropped = [...sql.matchAll(/drop view if exists public\.(\w+)/g)].map((m) => m[1]);
    const created = [...sql.matchAll(/create view public\.(\w+)/g)].map((m) => m[1]);
    expect(dropped.length).toBe(11);
    for (const v of dropped) expect(created).toContain(v);
  });

  it("تابع تبدیل بسته تعریف شده", () => {
    expect(sql).toMatch(/create or replace function public\.pack_to_base/);
    // بسته‌ی تعریف‌نشده ضریب یک، نه صفر.
    expect(sql).toMatch(/if v_size is null or v_size <= 0 then\s+return coalesce\(p_packs, 0\)/);
  });

  it("فایل بازگشت وجود دارد و درباره‌ی گرد شدن هشدار می‌دهد", () => {
    const down = read("supabase/rollbacks/0048_units_and_weight.down.sql");
    expect(down).toMatch(/drop function if exists public\.pack_to_base/);
    expect(down).toMatch(/گرد/);
  });
});

describe("🔴 محافظ موجودی هنگام تغییر نوع ستون", () => {
  const sql = readCode("supabase/migrations/0048_units_and_weight.sql");

  /*
    Postgres اجازه‌ی تغییر نوع ستونی که در تعریف تریگر آمده نمی‌دهد:
      cannot alter type of a column used in a trigger definition

    تریگر guard_stock_qty همان محافظی است که نمی‌گذارد کسی موجودی را
    مستقیم دستکاری کند. اگر حذف شود و بازنگردد، هر کلاینتی می‌تواند
    stock_qty را بنویسد و موجودی برای همیشه از stock_movements جدا
    می‌افتد — بی‌صدا.
  */
  it("محافظ موجودی پس از تغییر نوع دوباره ساخته می‌شود", () => {
    expect(sql).toMatch(/drop trigger if exists trg_guard_stock_qty on public\.product_variants/);
    expect(sql).toMatch(
      /create trigger trg_guard_stock_qty\s+before update of stock_qty on public\.product_variants\s+for each row execute function public\.guard_stock_qty_update\(\)/
    );
  });

  it("حذف محافظ پیش از تغییر نوع و ساختش پس از آن انجام می‌شود", () => {
    const iDrop = sql.indexOf("drop trigger if exists trg_guard_stock_qty");
    const iAlter = sql.indexOf("alter column stock_qty type numeric");
    const iCreate = sql.indexOf("create trigger trg_guard_stock_qty");
    expect(iDrop).toBeGreaterThan(-1);
    expect(iAlter).toBeGreaterThan(iDrop);
    expect(iCreate).toBeGreaterThan(iAlter);
  });
});

describe("🔴 مقدار اعشاری در توابع مالی (مهاجرت ۰۰۴۹)", () => {
  const sql = readCode("supabase/migrations/0049_fractional_qty_functions.sql");

  /*
    مهاجرت ۰۰۴۸ نیمه‌کاره بود: ستون‌ها numeric شدند ولی توابعی که در
    آن‌ها می‌نویسند مقدار را با (it->>'qty')::int از JSON می‌خواندند.

    اندازه‌گیری روی دیتابیس زنده، پیش از رفع:
        1.5  -> 2     (گرد به بالا)
        0.25 -> 0     (کالا رایگان می‌شد!)
    پس از رفع:
        1.5  x 100000 = 150000 ✅
        0.25 x 100000 = 25000  ✅

    بدترین بخش: **بی‌صدا** بود. مبلغ از همان مقدار گردشده حساب می‌شد،
    پس ناهماهنگی دیده نمی‌شد؛ فقط موجودی انبار دروغ می‌گفت.
  */
  it("هیچ cast صحیح روی مقدار باقی نمانده", () => {
    expect(sql).not.toMatch(/qty'\)::int\b/);
    expect(sql).toMatch(/\(it->>'qty'\)::numeric/);
  });

  it("هر چهار تابع مالی بازنویسی شده‌اند", () => {
    for (const fn of ["create_sale", "create_purchase", "update_sale_invoice", "update_purchase_invoice"]) {
      // pg_get_functiondef حروف بزرگ می‌دهد؛ تطبیق حروف‌ناحساس.
      expect(sql).toMatch(new RegExp(`create or replace function public\\.${fn}\\b`, "i"));
    }
  });

  /*
    ستون line_total از نوع bigint است. بدون round صریح، ضرب numeric
    مقدار اعشاری می‌دهد و Postgres هنگام درج آن را گرد می‌کند — ولی
    محاسبات میانی (v_subtotal) با آن نمی‌خواند.
  */
  it("مبلغ سطر صریحاً گرد می‌شود", () => {
    expect(sql).toMatch(/round\(\(it->>'unit_price'\)::bigint \* \(it->>'qty'\)::numeric\)::bigint/);
  });

  /*
    🔴 تغییر امضا در Postgres یک overload جدید می‌سازد و PostgREST
    خطای PGRST203 می‌دهد. این تله دو بار قبلاً زده شده.
  */
  it("امضای توابع عوض نشده — هیچ پارامتر numeric جدیدی اضافه نشده", () => {
    expect(sql).toMatch(/p_items jsonb/);
    expect(sql).not.toMatch(/p_qty numeric/);
  });

  it("فایل بازگشت هشدار خرابی موجودی می‌دهد", () => {
    const down = read("supabase/rollbacks/0049_fractional_qty_functions.down.sql");
    expect(down).toMatch(/qty <> round\(qty\)/);
  });
});

describe("اتصال واحد به رابط کاربری", () => {
  const posFile = readCode("app/(app)/sales/components/PosPieces.tsx");
  /*
    ⚠️ فقط بدنه‌ی QtyStepper بریده می‌شود.

    سه کامپوننت در این فایل متغیر `draft` دارند (MarginInput و
    PriceInput هم). تست روی کل فایل با خنثی‌کردن draft در QtyStepper
    همچنان سبز می‌ماند چون به draft آن دو می‌خورد — راستی‌آزمایی
    عمدی همین را نشان داد.
  */
  const stepperStart = posFile.indexOf("function QtyStepper(");
  const stepper = posFile.slice(stepperStart, posFile.indexOf("\nfunction ", stepperStart + 10));
  const panel = readCode("src/shared/panels/ProductPanel.tsx");
  const selector = readCode("components/shared/product-selector.tsx");

  /*
    🔴 QtyStepper فقط دو دکمه‌ی + و − بود و هیچ راهی برای تایپ نداشت.
    یعنی «۱٫۵ کیلو» غیرقابل ثبت بود و «۲۴ عدد» یعنی ۲۴ بار کلیک.
  */
  it("کادر تعداد قابل تایپ است", () => {
    expect(stepper).toMatch(/onBlur=\{\(e\) => commit\(e\.target\.value\)\}/);
    expect(stepper).toMatch(/inputMode=\{fractional \? "decimal" : "numeric"\}/);
  });

  /*
    متن در حالت ویرایش جدا از مقدار نگه داشته می‌شود، وگرنه کاربر که
    می‌خواهد «۱٫۵» بزند به‌محض تایپ «۱٫» عددش گرد می‌شود و ممیز پاک
    می‌شود — تایپ عدد اعشاری عملاً ناممکن.
  */
  it("متن در حال تایپ جدا از مقدار نگه داشته می‌شود", () => {
    expect(stepper).toMatch(/const \[draft, setDraft\] = React\.useState<string \| null>\(null\)/);
    /*
      وجود متغیر کافی نیست — باید واقعاً استفاده شود:
      ۱) کادر مقدارش را از draft بخواند (نه فقط از qty)
      ۲) هر تایپ draft را به‌روز کند
      ۳) موقع خروج از کادر draft پاک شود
      نسخه‌ی اول این تست فقط بند صفر را چک می‌کرد و با خنثی‌کردن
      draft همچنان سبز می‌ماند.
    */
    expect(stepper).toMatch(/value=\{draft \?\? toFaDigits\(formatQty\(qty, unit\)\)\}/);
    expect(stepper).toMatch(/onChange=\{\(e\) => setDraft\(e\.target\.value\)\}/);
    expect(stepper).toMatch(/setDraft\(null\);/);
  });

  it("گام دکمه برای کالای وزنی اعشاری است", () => {
    expect(stepper).toMatch(/const step = fractional \? 0\.25 : 1/);
  });

  it("فرم کالا واحد و بسته می‌پرسد", () => {
    expect(panel).toMatch(/واحد شمارش/);
    expect(panel).toMatch(/unit: productForm\.unit/);
    expect(panel).toMatch(/pack_size: productForm\.packSize/);
  });

  it("انتخابگر کالا واحد را همراه می‌آورد", () => {
    expect(selector).toMatch(/unit, unit_label, pack_label, pack_size/);
    expect(selector).toMatch(/unit: \(v\.product\?\.unit as UnitKind\) \?\? "count"/);
  });
});
