import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  effectiveSalePrice,
  effectivePurchasePrice,
  listDisplayPrice,
  hasPriceMismatch,
} from "@/lib/pricing";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const readCode = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("🔴 قیمت مؤثر — باگ «شومیز کتیبه»", () => {
  /*
    گزارش کاربر: «توی لیست کالا قیمت فروش درسته ولی جایی که فاکتور
    فروش کالا رو اضافه می‌کنیم قیمتش اشتباه هستش».

    داده‌ی واقعی هنگام بررسی:
      شومیز کتیبه → base_sale_price = ۱۵٬۹۰۰٬۰۰۰ ریال
                    variant.sale_price = ۹۷۰٬۰۰۰ ریال
    فهرست ۱٬۵۹۰٬۰۰۰ تومان می‌گفت و فاکتور ۹۷٬۰۰۰ تومان.

    علت: ترتیب اولویت در دو فایل **برعکس** بود.
  */
  const SHOMIZ_PRODUCT = { base_sale_price: 15_900_000, base_purchase_price: 9_700_000 };
  const SHOMIZ_VARIANT = { sale_price: 970_000, purchase_price: 970_000 };

  it("قیمت واریانت بر قیمت پایه مقدم است", () => {
    // فاکتور — که پول واقعی جابه‌جا می‌کند — همیشه از واریانت می‌خواند،
    // پس همان مبنا برای همه‌جاست.
    expect(effectiveSalePrice(SHOMIZ_VARIANT, SHOMIZ_PRODUCT)).toBe(970_000);
  });

  it("واریانت بدون قیمت از پایه ارث می‌برد", () => {
    expect(effectiveSalePrice({ sale_price: null }, SHOMIZ_PRODUCT)).toBe(15_900_000);
  });

  it("🔴 قیمت صفر معتبر است و به پایه نمی‌افتد", () => {
    /*
      با `||` به‌جای `??`، قیمت صفر رد می‌شد و به قیمت پایه می‌رسید.
      کالای هدیه یا نمونه واقعاً قیمت صفر دارد؛ تفاوت «قیمت ندارد» با
      «قیمتش صفر است» باید حفظ شود.
    */
    expect(effectiveSalePrice({ sale_price: 0 }, SHOMIZ_PRODUCT)).toBe(0);
  });

  it("نبود هر دو یعنی صفر", () => {
    expect(effectiveSalePrice(null, null)).toBe(0);
    expect(effectiveSalePrice(undefined, undefined)).toBe(0);
  });

  it("قیمت خرید همان قاعده را دارد", () => {
    expect(effectivePurchasePrice(SHOMIZ_VARIANT, SHOMIZ_PRODUCT)).toBe(970_000);
    expect(effectivePurchasePrice({ purchase_price: null }, SHOMIZ_PRODUCT)).toBe(9_700_000);
  });
});

describe("قیمت نمایشی در فهرست", () => {
  const product = { base_sale_price: 1_000_000 };

  it("یک واریانت → همان قیمت، بدون «از»", () => {
    const r = listDisplayPrice(product, [{ sale_price: 800_000 }]);
    expect(r.price).toBe(800_000);
    expect(r.mixed).toBe(false);
  });

  it("واریانت‌های هم‌قیمت → بدون «از»", () => {
    const r = listDisplayPrice(product, [{ sale_price: 800_000 }, { sale_price: 800_000 }]);
    expect(r.mixed).toBe(false);
  });

  it("🔴 قیمت‌های متفاوت → کمینه با پرچم mixed", () => {
    /*
      اگر یکی از قیمت‌ها را بی‌قید نشان دهیم، کاربر فکر می‌کند قیمت
      همان است و بعد در فاکتور عدد دیگری می‌بیند — دقیقاً همان
      شکایتی که گزارش شد. «از ۸۰۰٬۰۰۰» صادقانه است.
    */
    const r = listDisplayPrice(product, [
      { sale_price: 800_000 },
      { sale_price: 1_200_000 },
    ]);
    expect(r.price).toBe(800_000);
    expect(r.mixed).toBe(true);
  });

  it("بدون واریانت → قیمت پایه", () => {
    expect(listDisplayPrice(product, []).price).toBe(1_000_000);
    expect(listDisplayPrice(product, null).price).toBe(1_000_000);
  });

  it("واریانت بدون قیمت از پایه ارث می‌برد و mixed نمی‌شود", () => {
    const r = listDisplayPrice(product, [{ sale_price: null }, { sale_price: 1_000_000 }]);
    expect(r.price).toBe(1_000_000);
    expect(r.mixed).toBe(false);
  });

  it("🔴 مورد واقعی «شومیز کتیبه» یکسان گزارش می‌شود", () => {
    const p = { base_sale_price: 15_900_000 };
    const v = [{ sale_price: 970_000 }];
    // فهرست و فاکتور باید *یک* عدد بدهند.
    expect(listDisplayPrice(p, v).price).toBe(effectiveSalePrice(v[0], p));
  });
});

describe("تشخیص اختلاف قیمت", () => {
  it("اختلاف واقعی گزارش می‌شود", () => {
    expect(hasPriceMismatch({ sale_price: 970_000 }, { base_sale_price: 15_900_000 })).toBe(true);
  });
  it("قیمت یکسان اختلاف نیست", () => {
    expect(hasPriceMismatch({ sale_price: 100 }, { base_sale_price: 100 })).toBe(false);
  });
  it("واریانت بدون قیمت اختلاف حساب نمی‌شود", () => {
    // از پایه ارث می‌برد، پس تعریفاً برابر است.
    expect(hasPriceMismatch({ sale_price: null }, { base_sale_price: 100 })).toBe(false);
  });
});

describe("🔴 همه‌ی صفحه‌ها از منبع واحد می‌خوانند", () => {
  it("فهرست کالاها", () => {
    const page = readCode("app/(app)/products/page.tsx");
    expect(page).toContain("listDisplayPrice(p, p.product_variants)");
    // منطق دستی قدیمی نباید برگردد
    expect(page).not.toContain("p.base_sale_price || p.product_variants.find");
  });

  it("انتخابگر کالا", () => {
    const sel = readCode("components/shared/product-selector.tsx");
    expect(sel).toContain("effectiveSalePrice(v, v.product)");
    expect(sel).toContain("effectivePurchasePrice(v, v.product)");
  });

  it("🔴 ترتیب اولویت در هر دو یکی است", () => {
    /*
      این تست قلب ماجراست. تا وقتی هر دو مقدار یکی باشند هیچ‌کس
      متوجه اختلاف نمی‌شود؛ به‌محض جدا شدن، دو صفحه دو عدد نشان
      می‌دهند و کاربر به قیمت‌ها بی‌اعتماد می‌شود.
    */
    const product = { base_sale_price: 15_900_000 };
    const variant = { sale_price: 970_000 };
    const fromList = listDisplayPrice(product, [variant]).price;
    const fromPicker = effectiveSalePrice(variant, product);
    expect(fromList).toBe(fromPicker);
  });

  it("کالای چندقیمتی در فهرست «از» نشان می‌دهد", () => {
    const page = read("app/(app)/products/page.tsx");
    expect(page).toContain("priceMixed");
  });
});
