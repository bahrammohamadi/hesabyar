import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  pickTier,
  tierPriceRial,
  nextTierHint,
  creditStatus,
  canConvertOrder,
  isOrderExpired,
  type PriceTier,
} from "@/lib/wholesale";

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

/** پلکان نمونه: ۱۰ تایی ۱۰٪، ۵۰ تایی ۱۸٪. قیمت پایه ۱۰۰٬۰۰۰ ریال. */
const BASE = 100_000;
const TIERS: PriceTier[] = [
  { variant_id: null, min_qty: 10, unit_price: null, discount_percent: 10 },
  { variant_id: null, min_qty: 50, unit_price: null, discount_percent: 18 },
];
const V = "variant-1";

describe("پلکان قیمت عمده", () => {
  it("زیر اولین پله، قیمت پایه می‌ماند", () => {
    expect(tierPriceRial({ basePriceRial: BASE, qty: 9, tiers: TIERS, variantId: V })).toBe(100_000);
  });

  it("دقیقاً روی پله، پله اعمال می‌شود", () => {
    expect(tierPriceRial({ basePriceRial: BASE, qty: 10, tiers: TIERS, variantId: V })).toBe(90_000);
  });

  it("بین دو پله، پله‌ی پایین‌تر برنده است", () => {
    expect(tierPriceRial({ basePriceRial: BASE, qty: 49, tiers: TIERS, variantId: V })).toBe(90_000);
  });

  it("بالای آخرین پله، همان آخرین پله می‌ماند", () => {
    expect(tierPriceRial({ basePriceRial: BASE, qty: 5000, tiers: TIERS, variantId: V })).toBe(82_000);
  });

  /*
    🔴 این تست همان «حفره»ای را می‌گیرد که با بازه‌ی min..max پیش می‌آمد.
    با min_qty تنها، هیچ تعدادی نمی‌تواند به هیچ پله‌ای نخورد.
  */
  it("هیچ تعدادی بدون پله نمی‌ماند وقتی پله‌ها ناپیوسته‌اند", () => {
    const sparse: PriceTier[] = [
      { variant_id: null, min_qty: 1, unit_price: null, discount_percent: 0 },
      { variant_id: null, min_qty: 20, unit_price: null, discount_percent: 15 },
    ];
    for (const q of [1, 5, 15, 19, 20, 21, 999]) {
      expect(pickTier(sparse, V, q)).not.toBeNull();
    }
  });

  it("پله‌ی مخصوص کالا بر پله‌ی عمومی مقدم است", () => {
    const mixed: PriceTier[] = [
      ...TIERS,
      { variant_id: V, min_qty: 10, unit_price: 70_000, discount_percent: null },
    ];
    // عمومی ۹۰٬۰۰۰ می‌داد؛ اختصاصی ۷۰٬۰۰۰ برنده است.
    expect(tierPriceRial({ basePriceRial: BASE, qty: 12, tiers: mixed, variantId: V })).toBe(70_000);
  });

  it("پله‌ی کالای دیگر روی این کالا اثر ندارد", () => {
    const other: PriceTier[] = [
      { variant_id: "variant-other", min_qty: 2, unit_price: 1_000, discount_percent: null },
    ];
    expect(tierPriceRial({ basePriceRial: BASE, qty: 100, tiers: other, variantId: V })).toBe(100_000);
  });

  it("پله‌ی غیرفعال نادیده گرفته می‌شود", () => {
    const off: PriceTier[] = [{ ...TIERS[0], is_active: false }];
    expect(tierPriceRial({ basePriceRial: BASE, qty: 20, tiers: off, variantId: V })).toBe(100_000);
  });

  it("بدون پله، قیمت اختصاصی لیست برنده است", () => {
    expect(
      tierPriceRial({ basePriceRial: BASE, qty: 3, variantId: V, explicitPriceRial: 88_000 })
    ).toBe(88_000);
  });

  it("بدون پله و بدون قیمت اختصاصی، درصد عمومی لیست اعمال می‌شود", () => {
    expect(
      tierPriceRial({ basePriceRial: BASE, qty: 3, variantId: V, listDiscountPercent: 5 })
    ).toBe(95_000);
  });

  it("پله بر قیمت اختصاصی مقدم است", () => {
    expect(
      tierPriceRial({ basePriceRial: BASE, qty: 10, tiers: TIERS, variantId: V, explicitPriceRial: 99_000 })
    ).toBe(90_000);
  });

  it("قیمت هرگز منفی نمی‌شود", () => {
    const crazy: PriceTier[] = [
      { variant_id: null, min_qty: 1, unit_price: null, discount_percent: 999 },
    ];
    expect(tierPriceRial({ basePriceRial: BASE, qty: 5, tiers: crazy, variantId: V })).toBe(0);
  });

  it("تعداد صفر یا منفی مثل یک رفتار می‌کند", () => {
    expect(tierPriceRial({ basePriceRial: BASE, qty: 0, tiers: TIERS, variantId: V })).toBe(100_000);
    expect(tierPriceRial({ basePriceRial: BASE, qty: -5, tiers: TIERS, variantId: V })).toBe(100_000);
  });
});

describe("پیشنهاد پله‌ی بعدی", () => {
  it("نزدیک‌ترین پله‌ی بالاتر را پیشنهاد می‌دهد، نه بهترین قیمت", () => {
    const hint = nextTierHint({ basePriceRial: BASE, qty: 7, tiers: TIERS, variantId: V });
    expect(hint).not.toBeNull();
    expect(hint!.atQty).toBe(10);
    expect(hint!.addQty).toBe(3);
    expect(hint!.newPriceRial).toBe(90_000);
    expect(hint!.savingPerUnitRial).toBe(10_000);
  });

  it("روی آخرین پله پیشنهادی نمی‌دهد", () => {
    expect(nextTierHint({ basePriceRial: BASE, qty: 60, tiers: TIERS, variantId: V })).toBeNull();
  });

  /*
    🔴 پله‌ی گران‌تر نباید تبلیغ شود. کاربر ممکن است اشتباهی پله‌ای
    تعریف کند که قیمت را بالا می‌برد؛ پیشنهاد «۵ تا بیشتر بگیر تا
    گران‌تر شود» مسخره است.
  */
  it("پله‌ای که ارزان‌تر نیست پیشنهاد نمی‌شود", () => {
    const worse: PriceTier[] = [
      { variant_id: null, min_qty: 10, unit_price: 120_000, discount_percent: null },
    ];
    expect(nextTierHint({ basePriceRial: BASE, qty: 5, tiers: worse, variantId: V })).toBeNull();
  });

  it("بدون پله چیزی پیشنهاد نمی‌دهد", () => {
    expect(nextTierHint({ basePriceRial: BASE, qty: 5, variantId: V })).toBeNull();
  });
});

describe("اعتبار مشتری", () => {
  /*
    🔴 سقف صفر یعنی «تعریف نشده» نه «ممنوع».
    اگر صفر را ممنوع می‌گرفتیم، هر ۵۵۲ مشتری موجود که credit_limit
    ندارند با اولین دیپلوی مسدود می‌شدند.
  */
  it("سقف صفر یعنی تعریف‌نشده، نه ممنوع", () => {
    const s = creditStatus({ creditLimitRial: 0, balanceRial: 50_000_000, pendingCreditRial: 9_000_000 });
    expect(s.remainingRial).toBeNull();
    expect(s.overLimit).toBe(false);
    expect(s.wouldExceed).toBe(false);
  });

  it("مانده بیشتر از سقف یعنی از سقف رد شده", () => {
    const s = creditStatus({ creditLimitRial: 10_000_000, balanceRial: 12_000_000 });
    expect(s.overLimit).toBe(true);
    expect(s.remainingRial).toBe(-2_000_000);
  });

  it("فاکتور در دست ثبت در محاسبه‌ی رد شدن از سقف می‌آید", () => {
    const s = creditStatus({ creditLimitRial: 10_000_000, balanceRial: 8_000_000, pendingCreditRial: 3_000_000 });
    expect(s.overLimit).toBe(false);
    expect(s.wouldExceed).toBe(true);
  });

  it("دقیقاً روی سقف هنوز مجاز است", () => {
    const s = creditStatus({ creditLimitRial: 10_000_000, balanceRial: 7_000_000, pendingCreditRial: 3_000_000 });
    expect(s.wouldExceed).toBe(false);
  });

  it("مشتری بستانکار مانده‌ی منفی دارد و باقیمانده‌اش بیشتر از سقف است", () => {
    const s = creditStatus({ creditLimitRial: 10_000_000, balanceRial: -2_000_000 });
    expect(s.remainingRial).toBe(12_000_000);
    expect(s.overLimit).toBe(false);
  });
});

describe("تبدیل پیش‌فاکتور", () => {
  it("پیش‌فاکتور در انتظار قابل تبدیل است", () => {
    expect(canConvertOrder({ status: "pending", itemCount: 2 }).ok).toBe(true);
  });

  it("پیش‌فاکتور تبدیل‌شده دوباره تبدیل نمی‌شود", () => {
    expect(canConvertOrder({ status: "converted" }).ok).toBe(false);
  });

  /*
    وضعیت ممکن است هنوز pending باشد ولی converted_to_id پر باشد
    (اگر update وضعیت شکست خورده باشد). هر دو باید چک شوند.
  */
  it("وجود converted_to_id به‌تنهایی جلوی تبدیل را می‌گیرد", () => {
    expect(canConvertOrder({ status: "pending", converted_to_id: "sale-1" }).ok).toBe(false);
  });

  it("پیش‌فاکتور لغو شده قابل تبدیل نیست", () => {
    expect(canConvertOrder({ status: "cancelled" }).ok).toBe(false);
  });

  it("پیش‌فاکتور بدون قلم قابل تبدیل نیست", () => {
    expect(canConvertOrder({ status: "pending", itemCount: 0 }).ok).toBe(false);
  });
});

describe("انقضای پیش‌فاکتور", () => {
  /*
    🔴 فقط تاریخ مقایسه می‌شود نه لحظه. اگر ساعت حساب می‌شد،
    پیش‌فاکتوری که «تا امروز» اعتبار دارد از ۰۰:۰۰ همان روز منقضی
    به‌نظر می‌رسید و کاربر یک روز کامل را از دست می‌داد.
  */
  it("در روز انقضا هنوز معتبر است", () => {
    const now = new Date(2026, 7, 16, 18, 30);
    expect(isOrderExpired("2026-08-16T00:00:00Z", now)).toBe(false);
  });

  it("روز بعد منقضی است", () => {
    const now = new Date(2026, 7, 17, 0, 1);
    expect(isOrderExpired("2026-08-16T00:00:00Z", now)).toBe(true);
  });

  it("بدون تاریخ انقضا هرگز منقضی نمی‌شود", () => {
    expect(isOrderExpired(null)).toBe(false);
    expect(isOrderExpired(undefined)).toBe(false);
  });

  it("تاریخ خراب منقضی حساب نمی‌شود", () => {
    expect(isOrderExpired("قطعا-تاریخ-نیست")).toBe(false);
  });
});

describe("همسانی TypeScript و SQL", () => {
  const sql = readCode("supabase/migrations/0047_wholesale_tiers.sql");

  it("تابع tier_price_for در مهاجرت تعریف شده", () => {
    expect(sql).toMatch(/create or replace function public\.tier_price_for/);
  });

  /*
    🔴 مهم‌ترین ادعای این فایل: SQL هم پله‌ی اختصاصی را بر عمومی
    مقدم می‌داند. اگر این ترتیب در SQL برعکس شود، قیمتی که کاربر
    در سبد می‌بیند با آنچه ثبت می‌شود فرق می‌کند.
  */
  it("SQL پله‌ی اختصاصی کالا را بر پله‌ی عمومی مقدم می‌داند", () => {
    expect(sql).toMatch(/order by\s+\(t\.variant_id is not null\) desc,\s*t\.min_qty desc/);
  });

  it("SQL هم بزرگ‌ترین min_qty قابل‌اعمال را می‌گیرد", () => {
    expect(sql).toMatch(/t\.min_qty <= v_qty/);
  });

  /*
    🔴 بدون `for update` دو کلیک همزمان دو فاکتور می‌سازد و موجودی
    دو بار کم می‌شود. این تنها چیزی است که جلوی آن را می‌گیرد.
  */
  it("تبدیل پیش‌فاکتور قفل ردیف می‌گیرد", () => {
    expect(sql).toMatch(/from public\.sales_orders\s+where id = p_order\s+for update/);
  });

  it("تبدیل دوباره در SQL هم رد می‌شود", () => {
    expect(sql).toMatch(/if v_order\.status = 'converted' then/);
    expect(sql).toMatch(/raise exception '.*قبلاً به فاکتور تبدیل/);
  });

  it("تبدیل، وضعیت و شناسه‌ی فاکتور را هر دو می‌نویسد", () => {
    expect(sql).toMatch(/set status = 'converted', converted_to_id = v_sale/);
  });

  /*
    دو پله با همان min_qty نتیجه‌ی غیرقطعی می‌دهد. چون variant_id
    می‌تواند null باشد و در Postgres دو null برابر نیستند، unique
    معمولی کافی نیست و دو ایندکس جزئی لازم است.
  */
  it("پله‌ی تکراری با ایندکس یکتا جلویش گرفته شده — برای هر دو حالت", () => {
    expect(sql).toMatch(/create unique index[\s\S]*?uq_price_tiers_variant[\s\S]*?where variant_id is not null/);
    expect(sql).toMatch(/create unique index[\s\S]*?uq_price_tiers_all[\s\S]*?where variant_id is null/);
  });

  it("هر پله دقیقاً یکی از قیمت یا درصد را دارد", () => {
    expect(sql).toMatch(/constraint price_tiers_one_mode check/);
  });

  it("جدول پله RLS دارد", () => {
    expect(sql).toMatch(/alter table public\.price_tiers enable row level security/);
    expect(sql).toMatch(/create policy price_tiers_policy on public\.price_tiers/);
  });

  it("تبدیل، دسترسی ثبت فروش را چک می‌کند", () => {
    expect(sql).toMatch(/has_permission\('sales\.create'\)/);
  });

  it("تبدیل، عضویت در سازمان را چک می‌کند", () => {
    expect(sql).toMatch(/v_order\.org_id in \(select public\.user_org_ids\(\)\)/);
  });

  it("برای مهاجرت فایل بازگشت وجود دارد", () => {
    const down = read("supabase/rollbacks/0047_wholesale_tiers.down.sql");
    expect(down).toMatch(/drop table if exists public\.price_tiers/);
    expect(down).toMatch(/drop function if exists public\.convert_order_to_sale/);
    expect(down).toMatch(/drop function if exists public\.tier_price_for/);
  });
});

describe("🔴 رندر راست‌به‌چپ و برچسب‌ها", () => {
  const editor = readCode("components/shared/price-tiers-editor.tsx");
  const listsPage = readCode("app/(app)/settings/price-lists/page.tsx");

  /*
    اندازه‌گیری با Range.getClientRects در کروم نشان داد وقتی `٪`
    بلافاصله کلمه‌ی فارسی بعدش می‌آید، bidi آن را به راستِ عدد
    می‌برد و کاربر «٪۱۰» می‌بیند — برعکس بقیه‌ی برنامه.
    `bdi` و FSI هیچ‌کدام جوابش ندادند؛ فقط جابه‌جایی کلمه.

    ⚠️ این باگ در DOM دیده نمی‌شود، فقط در رندر — پس تست باید روی
    *ترتیب نوشتن* باشد نه محتوای متن.
  */
  it("درصد تخفیف پله پس از کلمه می‌آید نه پیش از آن", () => {
    expect(editor).not.toMatch(/\}٪ تخفیف/);
    expect(editor).toMatch(/تخفیف \$\{toFaDigits/);
  });

  /*
    خانواده‌باگ تکرارشونده: `${توکن۱} · ${توکن۲}` در متن RTL بازچینش
    می‌شود و اعداد به هم می‌چسبند. راه‌حل مستندشده: span جدا در flex
    با جداکننده‌ی aria-hidden.
  */
  it("فراداده‌ی لیست قیمت span جدا دارد نه رشته‌ی به‌هم‌چسبیده", () => {
    expect(listsPage).not.toMatch(/نوع: \{list\.type\}/);
    expect(listsPage).toMatch(/aria-hidden="true">•</);
  });

  it("نوع لیست به فارسی ترجمه می‌شود", () => {
    expect(listsPage).toMatch(/LIST_TYPE_LABELS\[list\.type\]/);
    for (const t of ["wholesale", "customer_level", "special", "seasonal", "sale", "purchase", "vip"]) {
      expect(listsPage).toMatch(new RegExp(`${t}:\\s*"`));
    }
  });

  /*
    پنجره‌ی بومی مرورگر راست‌به‌چپ نیست، فونت وزیرمتن ندارد و روی
    موبایل کل صفحه را قفل می‌کند. TypeScript این دو مورد را گرفت
    چون hook هم‌نام import شد.
  */
  it("در این دو صفحه confirm بومی نمانده", () => {
    for (const code of [listsPage, readCode("app/(app)/sales/orders/page.tsx")]) {
      expect(code).not.toMatch(/if \(!confirm\(/);
      expect(code).toMatch(/await confirm\(\{/);
    }
  });
});

describe("اتصال پلکان به فاکتور فروش", () => {
  const form = readCode("src/shared/panels/InvoiceCreateForm.tsx");

  it("پله‌ها از دیتابیس خوانده می‌شوند", () => {
    expect(form).toMatch(/from\("price_tiers"\)/);
    expect(form).toMatch(/tierPriceRial/);
  });

  /*
    🔴 مهم‌ترین ادعا: تغییر تعداد باید قیمت را با پله‌ی جدید هماهنگ
    کند. بدون این، پله تعریف می‌شود ولی هرگز اعمال نمی‌شود چون کاربر
    معمولاً اول کالا را اضافه می‌کند و بعد تعداد را بالا می‌برد.
  */
  it("تغییر تعداد قیمت را دوباره حساب می‌کند", () => {
    expect(form).toMatch(/function repriceLine/);
    expect(form).toMatch(/updateQty[\s\S]{0,200}repriceLine/);
  });

  /*
    تصمیم صریح کاربر بر محاسبه‌ی خودکار مقدم است. بدون این پرچم،
    کاربر قیمت توافقی را می‌گذارد، تعداد را زیاد می‌کند و سیستم
    بی‌صدا قیمتش را پاک می‌کند.
  */
  it("قیمت دستی کاربر توسط پله بازنویسی نمی‌شود", () => {
    expect(form).toMatch(/price_edited: true/);
    expect(form).toMatch(/c\.price_edited\s*\n?\s*\?\s*c\.unit_price/);
  });

  it("سقف اعتبار مشتری خوانده و هشدار داده می‌شود", () => {
    expect(form).toMatch(/credit_limit/);
    expect(form).toMatch(/creditStatus\(/);
  });

  it("پیشنهاد پله‌ی بعدی رندر می‌شود", () => {
    expect(form).toMatch(/nextTierHint/);
    expect(form).toMatch(/پیشنهاد خرید عمده/);
  });
});

describe("تبدیل پیش‌فاکتور در رابط کاربری", () => {
  const page = readCode("app/(app)/sales/orders/page.tsx");

  it("از RPC اتمیک استفاده می‌کند نه دو فراخوانی جدا", () => {
    expect(page).toMatch(/rpc\("convert_order_to_sale"/);
  });

  /*
    ⚠️ کلاینت Supabase برای خطای دیتابیس استثنا پرتاب نمی‌کند —
    خطا در `error` است. بدون این چک، شکست تبدیل «موفق» گزارش می‌شد.
  */
  it("خطای برگشتی از RPC بررسی می‌شود", () => {
    expect(page).toMatch(/rpc\("convert_order_to_sale"[\s\S]{0,200}if \(error\) throw error/);
  });

  it("دکمه هنگام تبدیل غیرفعال می‌شود تا کلیک دوباره نشود", () => {
    expect(page).toMatch(/disabled=\{converting === order\.id\}/);
  });

  it("گارد سمت کلاینت هم چک می‌شود", () => {
    expect(page).toMatch(/canConvertOrder\(order\)/);
  });

  it("انقضای پیش‌فاکتور نشان داده می‌شود", () => {
    expect(page).toMatch(/isOrderExpired\(order\.expiry_date\)/);
  });
});
