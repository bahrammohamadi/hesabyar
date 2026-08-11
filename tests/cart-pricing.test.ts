import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  lineDiscountRial, lineNetRial, discountRialToPercent,
  marginPercent, saleFromMargin, priceFromPercent, percentFromPrice,
} from "@/lib/cart-pricing";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*(\/\/|--).*$/gm, "");

describe("تخفیف هر قلم", () => {
  it("تخفیف مبلغی عیناً اعمال می‌شود", () => {
    // ۱۰۰٬۰۰۰ ریال تخفیف روی سطر ۳×۵۰٬۰۰۰
    expect(lineDiscountRial(50_000, 3, "amount", 100_000)).toBe(100_000);
  });

  it("🔴 تخفیف درصدی روی *کل سطر* حساب می‌شود نه قیمت واحد", () => {
    /*
      اگر مبنا قیمت واحد بود، «۱۰٪ تخفیف» روی ۳ عدد کالا فقط یک‌سوم
      انتظار کاربر را کم می‌کرد.
    */
    expect(lineDiscountRial(50_000, 3, "percent", 10)).toBe(15_000); // ۱۰٪ از ۱۵۰٬۰۰۰
  });

  it("🔴 تخفیف هرگز از مبلغ سطر بیشتر نمی‌شود", () => {
    /*
      بدون این سقف، جمع فاکتور منفی می‌شد و create_sale سند بی‌معنا
      ثبت می‌کرد.
    */
    expect(lineDiscountRial(50_000, 1, "amount", 999_999)).toBe(50_000);
    expect(lineDiscountRial(50_000, 2, "percent", 300)).toBe(100_000);
  });

  it("درصد بیش از صد به صد محدود می‌شود", () => {
    expect(lineDiscountRial(10_000, 1, "percent", 150)).toBe(10_000);
  });

  it("ورودی منفی یا نامعتبر صفر می‌شود", () => {
    expect(lineDiscountRial(50_000, 1, "amount", -100)).toBe(0);
    expect(lineDiscountRial(50_000, 1, "amount", NaN)).toBe(0);
    expect(lineDiscountRial(50_000, 1, "percent", -5)).toBe(0);
  });

  it("سطر با قیمت یا تعداد صفر تخفیف نمی‌گیرد", () => {
    // جلوگیری از تقسیم بر صفر و تخفیف روی هیچ.
    expect(lineDiscountRial(0, 5, "percent", 10)).toBe(0);
    expect(lineDiscountRial(50_000, 0, "amount", 1000)).toBe(0);
  });

  it("مبلغ نهایی سطر هرگز منفی نیست", () => {
    expect(lineNetRial(50_000, 2, 30_000)).toBe(70_000);
    expect(lineNetRial(50_000, 1, 999_999)).toBe(0);
  });

  it("🔴 تبدیل ریال به درصد، تخفیف را هنگام تعویض حالت حفظ می‌کند", () => {
    /*
      وقتی کاربر از «مبلغ» به «درصد» سوئیچ می‌کند، کادر باید تخفیف
      فعلی را نشان بدهد نه صفر — وگرنه تخفیف قبلی بی‌صدا پاک می‌شود.
    */
    expect(discountRialToPercent(50_000, 2, 10_000)).toBe(10);
    expect(discountRialToPercent(0, 2, 10_000)).toBe(0);
  });

  it("رفت‌وبرگشت مبلغ ⇄ درصد پایدار است", () => {
    const rial = lineDiscountRial(100_000, 3, "percent", 25);
    expect(discountRialToPercent(100_000, 3, rial)).toBe(25);
  });
});

describe("درصد سود در فاکتور خرید", () => {
  it("سود از قیمت خرید حساب می‌شود", () => {
    expect(marginPercent(100_000, 140_000)).toBe(40);
  });

  it("سود منفی (فروش زیر قیمت خرید) گزارش می‌شود", () => {
    expect(marginPercent(100_000, 80_000)).toBe(-20);
  });

  it("🔴 قیمت خرید صفر تقسیم بر صفر نمی‌دهد", () => {
    // کالای هدیه یا نمونه قیمت خرید صفر دارد.
    expect(marginPercent(0, 50_000)).toBe(0);
    expect(Number.isFinite(marginPercent(0, 50_000))).toBe(true);
  });

  it("قیمت فروش از درصد ساخته می‌شود", () => {
    expect(saleFromMargin(100_000, 40)).toBe(140_000);
    expect(saleFromMargin(100_000, 0)).toBe(100_000);
  });

  it("درصد منفی قیمت را زیر خرید می‌برد ولی منفی نمی‌کند", () => {
    expect(saleFromMargin(100_000, -20)).toBe(80_000);
    expect(saleFromMargin(100_000, -500)).toBe(0);
  });

  it("رفت‌وبرگشت سود پایدار است", () => {
    const sale = saleFromMargin(250_000, 35);
    expect(marginPercent(250_000, sale)).toBe(35);
  });
});

describe("🔴 دکمه‌ی اعمال درصد سود", () => {
  const pos = readCode("app/(app)/sales/components/PosPieces.tsx");

  it("درصد فقط با دکمه/Enter/blur اعمال می‌شود، نه با هر کلید", () => {
    /*
      نسخه‌ی قبلی onChange مستقیم قیمت را بازمحاسبه می‌کرد. برای
      رسیدن به «۳۰»، تایپ «۳» فوراً قیمت را روی ۳٪ سود می‌برد و
      کاربر عملاً نمی‌توانست عدد دورقمی وارد کند.
    */
    expect(pos).toContain("function MarginInput");
    expect(pos).toContain("const [draft, setDraft] = React.useState<string | null>(null)");
    expect(pos).toContain("onBlur={commit}");
    expect(pos).toContain('if (e.key === "Enter")');
  });

  it("از منبع مشترک محاسبه استفاده می‌کند", () => {
    expect(pos).toContain("saleFromMargin(c.unit_price, pct)");
    expect(pos).toContain("marginPercent(item.unit_price");
  });

  it("درصد سود دیگر با هر onChange قیمت را عوض نمی‌کند", () => {
    // الگوی قدیمی: محاسبه‌ی مستقیم داخل onChange
    expect(pos).not.toContain("Math.round(c.unit_price * (1 + pct / 100))");
  });
});

describe("ورودی تخفیف هر قلم", () => {
  const pos = readCode("app/(app)/sales/components/PosPieces.tsx");
  const form = readCode("src/shared/panels/InvoiceCreateForm.tsx");

  it("کامپوننت تخفیف وجود دارد و دکمه‌ی تعویض واحد دارد", () => {
    expect(pos).toContain("function LineDiscountInput");
    expect(pos).toContain('onModeChange(isPercent ? "amount" : "percent")');
  });

  it("🔴 مقدار ذخیره‌شده همیشه ریال است نه درصد", () => {
    /*
      اگر درصد ذخیره می‌شد، تغییر بعدیِ تعداد یا قیمت، تخفیف را
      بی‌صدا عوض می‌کرد.
    */
    expect(pos).toContain("onChange(lineDiscountRial(item.unit_price, item.qty, mode, value))");
  });

  it("ستون تخفیف فقط با prop فعال می‌شود", () => {
    // سندهای بدون تخفیف سطری نباید ستون خالی بگیرند.
    expect(pos).toContain("const showDiscount = Boolean(onDiscountChange)");
  });

  it("فرم فروش تخفیف را به سبد وصل می‌کند", () => {
    expect(form).toContain("onDiscountChange={updateLineDiscount}");
    expect(form).toContain("function updateLineDiscount");
  });

  it("🔴 تغییر قیمت یا تعداد، تخفیف را دوباره محدود می‌کند", () => {
    /*
      بدون این، تخفیف ۵۰٬۰۰۰ روی کالایی که قیمتش به ۳۰٬۰۰۰ کم شده
      مبلغ سطر را منفی می‌کرد.
    */
    expect(form.match(/Math\.min\(c\.discount/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("جمع فاکتور از helper مشترک می‌آید", () => {
    expect(form).toContain("lineNetRial(c.unit_price, c.qty, c.discount)");
  });

  it("تخفیف هر قلم به create_sale فرستاده می‌شود", () => {
    // بک‌اند از قبل پشتیبانی می‌کرد؛ فقط UI نداشت.
    expect(form).toContain("discount: c.discount");
  });
});

describe("قیمت — منبع واحد", () => {
  it("هیچ‌جا منطق دستی قیمت تکرار نشده", () => {
    /*
      باگ اصلی کاربر از دو منطق متفاوت در دو فایل آمد. هر مصرف‌کننده
      باید از lib/pricing بخواند.
    */
    for (const p of [
      "components/shared/product-selector.tsx",
      "app/(app)/products/page.tsx",
    ]) {
      expect(readCode(p), p).toContain("lib/pricing");
    }
  });

  it("انتخابگر و فهرست هر دو effectiveSalePrice/listDisplayPrice دارند", () => {
    expect(readCode("components/shared/product-selector.tsx")).toContain("effectiveSalePrice");
    expect(readCode("app/(app)/products/page.tsx")).toContain("listDisplayPrice");
  });
});

/* ================================================================== */
/* تغییر قیمت به درصد — «قیمت رو هم بشه تغییر داد مثل درصد تخفیف»      */
/* ================================================================== */

describe("تغییر قیمت با درصد", () => {
  it("درصد مثبت قیمت را بالا می‌برد", () => {
    expect(priceFromPercent(100_000, 10)).toBe(110_000);
    expect(priceFromPercent(1_590_000, 30)).toBe(2_067_000);
  });

  it("درصد منفی یعنی ارزان‌تر", () => {
    expect(priceFromPercent(100_000, -10)).toBe(90_000);
  });

  it("صفر یعنی برگشت به قیمت اصلی", () => {
    expect(priceFromPercent(970_000, 0)).toBe(970_000);
  });

  it("🔴 دو بار زدن یک درصد، نتیجه را دو برابر نمی‌کند", () => {
    /*
      اگر مبنا قیمت *فعلی* بود، «۱۰» دو بار می‌شد ۲۱٪ و کاربر که فقط
      عدد را اصلاح می‌کرد، با هر تصحیح یک پله دورتر می‌شد. مبنا
      base_price ثابت است، پس نتیجه idempotent می‌ماند.
    */
    const base = 200_000;
    const once = priceFromPercent(base, 10);
    const twice = priceFromPercent(base, 10);
    expect(once).toBe(twice);
    expect(once).toBe(220_000);
  });

  it("🔴 قیمت هرگز منفی نمی‌شود", () => {
    // «۲۰۰-٪» عملاً بی‌معناست ولی نباید مبلغ منفی بسازد.
    expect(priceFromPercent(100_000, -200)).toBe(0);
    expect(priceFromPercent(-5_000, 10)).toBe(0);
  });

  it("ورودی نامعتبر مثل صفر رفتار می‌کند نه NaN", () => {
    expect(priceFromPercent(100_000, NaN)).toBe(100_000);
    expect(priceFromPercent(100_000, Infinity)).toBe(100_000);
  });

  it("درصد فعلی از روی قیمت محاسبه می‌شود — رفت‌وبرگشت سازگار است", () => {
    expect(percentFromPrice(100_000, 110_000)).toBe(10);
    expect(percentFromPrice(100_000, 90_000)).toBe(-10);
    expect(percentFromPrice(100_000, 100_000)).toBe(0);
    const base = 970_000;
    expect(percentFromPrice(base, priceFromPercent(base, 25))).toBe(25);
  });

  it("🔴 قیمت پایه‌ی صفر تقسیم بر صفر نمی‌دهد", () => {
    // کالای هدیه یا نمونه، قیمت پایه‌ی صفر دارد.
    expect(percentFromPrice(0, 50_000)).toBe(0);
    expect(Number.isFinite(percentFromPrice(0, 50_000))).toBe(true);
  });
});

describe("قیمت در رابط کاربری", () => {
  const pos = readCode("app/(app)/sales/components/PosPieces.tsx");

  it("🔴 در موبایلِ فروش، قیمت قابل ویرایش است نه فقط خواندنی", () => {
    /*
      باگ گزارش‌شده: در نسخه‌ی موبایل پنجره‌ی فروش فقط یک متن ثابت
      قیمت بود و هیچ کادری برای تغییرش وجود نداشت.

      شمارش: PriceInput باید سه بار رندر شود —
        دسکتاپ فروش، دسکتاپ خرید، موبایل فروش، موبایل خرید = ۴
    */
    const uses = pos.match(/<PriceInput/g) ?? [];
    expect(uses.length).toBe(4);
  });

  it("مبنای درصد، base_price است نه قیمت فعلی", () => {
    expect(pos).toContain("item.base_price ?? item.unit_price");
  });

  it("در حالت درصد با دکمه اعمال می‌شود نه با هر ضربه‌ی کیبورد", () => {
    /*
      اعمال لحظه‌ای باعث می‌شد برای رسیدن به «۳۰» اول روی «۳» بپرد.
      همان درسی که در MarginInput گرفتیم.
    */
    expect(pos).toContain("commitPercent");
    expect(pos).toContain('e.key === "Enter"');
  });

  it("هر دو فرم قیمت پایه را هنگام افزودن کالا ثبت می‌کنند", () => {
    expect(readCode("src/shared/panels/InvoiceCreateForm.tsx")).toContain("base_price:");
    expect(readCode("src/shared/panels/PurchaseCreateForm.tsx")).toContain("base_price:");
  });
});

/* ================================================================== */
/* تخفیف سطری در خرید                                                  */
/* ================================================================== */

describe("🔴 تخفیف هر قلم در فاکتور خرید", () => {
  const purchaseForm = readCode("src/shared/panels/PurchaseCreateForm.tsx");
  const pos = readCode("app/(app)/sales/components/PosPieces.tsx");
  const migration = readCode("supabase/migrations/0042_purchase_line_discount.sql");

  it("فرم خرید تخفیف سطری را به PosCartList وصل می‌کند", () => {
    expect(purchaseForm).toContain("onDiscountChange={updateLineDiscount}");
  });

  it("ستون تخفیف دیگر مخصوص فروش نیست", () => {
    /*
      شرط قبلی `!isPurchase && showDiscount` بود؛ یعنی حتی اگر
      فرم خرید callback می‌داد، ستون رندر نمی‌شد.
    */
    expect(pos).not.toContain("!isPurchase && showDiscount");
  });

  it("جمع فرم خرید تخفیف سطری را کم می‌کند", () => {
    /*
      اگر جمع خام می‌ماند، عددی که کاربر می‌بیند با عددی که در
      دیتابیس ثبت می‌شود فرق می‌کرد.
    */
    expect(purchaseForm).toContain("lineNetRial(c.unit_price, c.qty, c.discount)");
  });

  it("تخفیف در payload به RPC می‌رود", () => {
    expect(purchaseForm).toContain("discount: c.discount");
  });

  it("مهاجرت ستون را با پیش‌فرض صفر اضافه می‌کند تا ردیف قدیمی نشکند", () => {
    expect(migration).toContain("add column if not exists discount bigint not null default 0");
  });

  it("🔴 دیتابیس به ورودی کلاینت اعتماد نمی‌کند و تخفیف را سقف می‌زند", () => {
    /*
      تخفیف بزرگ‌تر از مبلغ سطر، جمع فاکتور را منفی می‌کرد. سمت
      کلاینت محدود می‌شود ولی درخواست مستقیم به RPC هم ممکن است.
    */
    const guards = migration.match(/least\(greatest\(coalesce\(\(it->>'discount'\)::bigint, 0\), 0\), v_line\)/g) ?? [];
    // در چهار حلقه: create (جمع + درج) و update (جمع + درج)
    expect(guards.length).toBe(4);
  });

  it("🔴 امضای تابع عوض نشده تا overload/PGRST203 نسازد", () => {
    /*
      درس مهاجرت ۰۰۳۰: create or replace روی امضای متفاوت، تابع دوم
      می‌سازد و PostgREST نمی‌تواند انتخاب کند. تخفیف عمداً داخل
      همان p_items jsonb می‌آید نه به‌عنوان پارامتر جدید.
    */
    expect(migration).not.toContain("p_line_discount");
    expect(migration).not.toContain("drop function if exists public.create_purchase");
  });
});
