import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("پنل خرید — یکسان‌سازی با فروش", () => {
  it("فرم مشترک خرید وجود دارد", () => {
    expect(existsSync(join(root, "src/shared/panels/PurchaseCreateForm.tsx"))).toBe(true);
  });

  it("پیام «از این مسیر ممکن نیست» حذف شده", () => {
    /*
      InvoicePanel قبلاً برای docType=purchase یک EmptyState نشان می‌داد
      و کاربر را به صفحه‌ی خرید می‌فرستاد که Modal جداگانه داشت — همان
      ناهماهنگی‌ای که کاربر گزارش کرد.
    */
    const src = read("src/shared/panels/InvoicePanel.tsx");
    expect(src).not.toContain("ایجاد فاکتور خرید از این مسیر ممکن نیست");
    expect(src).toContain("<PurchaseCreateForm");
  });

  it("Modal محلی خرید حذف شده", () => {
    const src = read("app/(app)/purchases/page.tsx");
    expect(src).not.toContain("function PurchaseModal");
    expect(src).toContain('openDocument("purchase", undefined, { mode: "create"');
  });

  it("خرید همان اجزای بصری فروش را استفاده می‌کند، نه کپی", () => {
    // ریشه‌ی شکایت کاربر وجود دو پیاده‌سازی موازی بود.
    const src = read("src/shared/panels/PurchaseCreateForm.tsx");
    for (const piece of ["PosCartList", "PosCustomerCard", "PosSearchBar", "PosSummaryCard", "PosInvoiceFields", "PosPaymentMethods"]) {
      expect(src).toContain(piece);
    }
  });

  it("امکاناتی که مودال قدیمی نداشت اضافه شده‌اند", () => {
    const src = read("src/shared/panels/PurchaseCreateForm.tsx");
    expect(src).toContain("BarcodeScanner");     // بارکدخوان
    expect(src).toContain("VoiceOrder");         // ورود صوتی
    expect(src).toContain("p_date: purchaseDate"); // انتخاب تاریخ
    expect(src).toContain("p_discount_type");    // تخفیف
    expect(src).toContain("p_paid_cash");        // تفکیک پرداخت
    expect(src).toContain("p_paid_card");
  });

  it("انتخابگرها پنل میزبان را نمی‌بندند", () => {
    // 🔴 بدون ownedByPanel، باز کردن انتخابگر کل فاکتور نیمه‌کاره را نابود می‌کند.
    const src = read("src/shared/panels/PurchaseCreateForm.tsx");
    expect(src).toContain("ownedByPanel={insidePanel}");
    expect(src.match(/ownedByPanel=\{insidePanel\}/g)?.length).toBe(2);
  });

  it("قیمت فروش داخل خود RPC می‌رود، نه update جداگانه", () => {
    /*
      🔴 نسخه‌ی قبلی بعد از create_purchase یک update روی
      product_variants می‌زد: هم تکراری بود (RPC خودش انجام می‌دهد) و
      هم بیرون از تراکنش — اگر شکست می‌خورد خرید ثبت شده بود ولی قیمت
      فروش نه.
    */
    const src = read("src/shared/panels/PurchaseCreateForm.tsx");
    expect(src).toContain("sale_price: c.sale_price");
    expect(src).not.toContain('.from("product_variants")');
  });
});

describe("PosCartList — یک کامپوننت برای دو سند", () => {
  const src = read("app/(app)/sales/components/PosPieces.tsx");

  it("prop variant دارد", () => {
    expect(src).toContain('variant?: "sale" | "purchase"');
  });

  it("در حالت خرید سه فیلد قیمت خرید/فروش/سود دارد", () => {
    expect(src).toContain("قیمت خرید ${c.product_name}");
    expect(src).toContain("قیمت فروش ${c.product_name}");
    expect(src).toContain("درصد سود ${c.product_name}");
  });

  it("درصد سود از قیمت خرید محاسبه می‌شود و تقسیم بر صفر ندارد", () => {
    expect(src).toContain("if (buy <= 0) return 0;");
  });

  it("تایپ درصد، قیمت فروش را می‌سازد", () => {
    // فروشنده می‌گوید «۴۰ درصد روش بکش»، نه اینکه عدد نهایی را بداند.
    expect(src).toContain("c.unit_price * (1 + pct / 100)");
  });

  it("هشدار موجودی در خرید نمایش داده نمی‌شود", () => {
    // خرید موجودی را زیاد می‌کند؛ «موجودی کافی نیست» آنجا بی‌معنی است.
    expect(src).toContain("!isPurchase && c.qty > c.stock_qty");
  });
});

describe("چیدمان — واکنش به عرض ظرف نه پنجره", () => {
  const css = read("app/globals.css");

  it("گرید تک‌ستونی minmax(0,1fr) دارد", () => {
    /*
      🔴 با اندازه‌گیری واقعی پیدا شد: ستون گرید پیش‌فرض `auto` است که
      کفش min-content می‌شود، پس محتوای عریض خودِ گرید را از پنل بیرون
      می‌برد.
        فروش: scrollWidth ۷۱۴px داخل ۵۱۹px → ۲۷ عنصر بیرون
        خرید: ۸۵۴px → ۳۳ عنصر
    */
    expect(css).toMatch(/\.invoice-form-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/);
  });

  it("ردیف‌های جدول با container query کنترل می‌شوند نه lg:", () => {
    /*
      `lg:grid` به عرض *پنجره* نگاه می‌کند. روی دسکتاپ ۱۴۴۰px آن شرط
      فعال بود و جدول چندستونی داخل پنل ۵۶۰px رندر می‌شد.
    */
    const tsx = read("app/(app)/sales/components/PosPieces.tsx");
    expect(tsx).toContain("pos-row-desktop");
    expect(tsx).toContain("pos-row-mobile");
    expect(tsx).not.toContain("lg:grid`");
    expect(css).toContain("@container invoiceform (min-width: 680px)");
    // خرید دو ستون بیشتر دارد پس آستانه‌ی بالاتری می‌خواهد
    expect(css).toContain("@container invoiceform (min-width: 820px)");
  });

  it("fallback برای مرورگر بدون container query هست", () => {
    expect(css).toMatch(/@supports not \(container-type: inline-size\)[\s\S]*?pos-row-desktop/);
  });
});

describe("همه‌ی مسیرهای ایجاد یکسان‌اند", () => {
  it("داشبورد «خرید جدید» پنل باز می‌کند نه لینک به صفحه", () => {
    const qa = read("app/(app)/dashboard/components/DashboardQuickActions.tsx");
    expect(qa).toContain("onOpenQuickPurchase");
    expect(qa).not.toContain('href="/purchases"');
    const page = read("app/(app)/dashboard/page.tsx");
    expect(page).toContain('openDocument("purchase", undefined, { mode: "create"');
  });

  it("دکمه‌ی شناور موبایل واقعاً رندر می‌شود", () => {
    // ⚠️ این کامپوننت نوشته شده بود ولی هیچ‌جا استفاده نمی‌شد — کد مرده.
    const shell = read("components/shared/app-shell.tsx");
    expect(shell).toContain("<MobileFab />");
    expect(shell).toContain('import { MobileFab }');
  });

  it("دکمه‌ی شناور پنل باز می‌کند نه ناوبری", () => {
    /*
      قبلاً «خرید جدید» فقط لینک به /purchases بود: کاربر یک بار کلیک
      می‌کرد، صفحه عوض می‌شد، و باید دوباره دکمه‌ی دیگری می‌زد.
    */
    const fab = read("components/shared/mobile-fab.tsx");
    expect(fab).toContain('openDocument("purchase"');
    expect(fab).toContain('openDocument("sale"');
    expect(fab).toContain('openEntity("contact"');
    expect(fab).toContain('openEntity("product"');
  });
});

describe("مهاجرت ۰۰۳۰ — تفکیک پرداخت خرید", () => {
  const mig = read("supabase/migrations/0030_purchase_split_payment.sql");

  it("نسخه‌ی قبلی تابع را drop می‌کند", () => {
    /*
      🔴 حیاتی و با آزمایش واقعی کشف شد: `create or replace` روی امضای
      متفاوت جایگزین نمی‌کند بلکه یک overload دوم می‌سازد. نتیجه:

        PGRST203 — Could not choose the best candidate function

      یعنی بدون این drop، ثبت خرید در کل برنامه از کار می‌افتاد.
    */
    expect(mig).toContain("drop function if exists public.create_purchase(");
    const dropIdx = mig.indexOf("drop function");
    const createIdx = mig.indexOf("create or replace function");
    expect(dropIdx).toBeGreaterThan(-1);
    expect(dropIdx).toBeLessThan(createIdx);
  });

  it("پارامترهای جدید اختیاری‌اند تا کد قدیمی نشکند", () => {
    // /purchases/[id] هنوز امضای قدیمی را صدا می‌زند.
    expect(mig).toContain("p_paid_cash bigint default null");
    expect(mig).toContain("p_paid_card bigint default null");
  });

  it("نبودِ پارامترهای جدید رفتار قبلی را حفظ می‌کند", () => {
    expect(mig).toContain("if p_paid_cash is null and p_paid_card is null then");
  });

  it("مقدار منفی نمی‌تواند تراکنش وارونه بسازد", () => {
    expect(mig).toContain("greatest(coalesce(p_paid_cash, 0), 0)");
    expect(mig).toContain("greatest(coalesce(p_paid_card, 0), 0)");
  });

  it("برای هر روش پرداخت یک تراکنش با method درست می‌سازد", () => {
    // قبلاً method همیشه 'cash' بود، حتی وقتی با کارت خرید شده بود.
    expect(mig).toContain("'cash', 'پرداخت نقدی بابت خرید '");
    expect(mig).toContain("'card', 'پرداخت کارتی بابت خرید '");
  });

  it("فایل بازگردانی وجود دارد و overload جدید را drop می‌کند", () => {
    const down = read("supabase/rollbacks/0030_purchase_split_payment.down.sql");
    expect(down).toContain("drop function if exists public.create_purchase(");
    expect(down).toContain("bigint, bigint\n)");
  });
});
