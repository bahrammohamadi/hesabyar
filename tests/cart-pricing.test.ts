import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  lineDiscountRial, lineNetRial, discountRialToPercent,
  marginPercent, saleFromMargin,
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
