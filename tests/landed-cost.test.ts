import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { allocateExtraCost, landedUnitCost } from "@/lib/cart-pricing";

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

/** سه قلم نمونه؛ هزینه‌ی جانبی ۵٬۰۰۰٬۰۰۰ ریال. */
const ITEMS = [
  { net: 6_000_000, qty: 2 },
  { net: 3_000_000, qty: 1 },
  { net: 1_000_000, qty: 5 },
];
const TOTAL_NET = ITEMS.reduce((s, i) => s + i.net, 0);
const TOTAL_QTY = ITEMS.reduce((s, i) => s + i.qty, 0);
const EXTRA = 5_000_000;

describe("🔴 سرشکن هزینه‌های جانبی", () => {
  /*
    باگی که این رفع می‌کند: `p_extra_total` فقط به جمع فاکتور اضافه
    می‌شد و روی `purchase_price` نمی‌نشست. چون `cost_price` از همان
    می‌آید، سود هر فروش بیشتر از واقعیت گزارش می‌شد.

    جدول `purchase_extra_costs` با ستون `allocation` از مهاجرت ۰۰۰۱
    وجود داشت و هرگز در هیچ کدی استفاده نشده بود.
  */
  it("به نسبت ارزش پخش می‌شود", () => {
    // ۶٬۰۰۰٬۰۰۰ از ۱۰٬۰۰۰٬۰۰۰ یعنی ۶۰٪ ⇒ ۳٬۰۰۰٬۰۰۰
    expect(
      allocateExtraCost({
        extraRial: EXTRA,
        lineNetRial: 6_000_000,
        lineQty: 2,
        totalNetRial: TOTAL_NET,
        totalQty: TOTAL_QTY,
        mode: "by_value",
      })
    ).toBe(3_000_000);
  });

  it("به نسبت تعداد پخش می‌شود", () => {
    // ۲ از ۸ عدد یعنی ۲۵٪ ⇒ ۱٬۲۵۰٬۰۰۰
    expect(
      allocateExtraCost({
        extraRial: EXTRA,
        lineNetRial: 6_000_000,
        lineQty: 2,
        totalNetRial: TOTAL_NET,
        totalQty: TOTAL_QTY,
        mode: "by_qty",
      })
    ).toBe(1_250_000);
  });

  it("🔴 جمع سهم‌ها برابر هزینه‌ی کل است", () => {
    /*
      مهم‌ترین ادعا. اگر گرد کردن باعث شود جمع کمتر یا بیشتر شود،
      قیمت تمام‌شده‌ی کل انبار به‌مرور از واقعیت فاصله می‌گیرد.
    */
    for (const mode of ["by_value", "by_qty"] as const) {
      const sum = ITEMS.reduce(
        (s, i) =>
          s +
          allocateExtraCost({
            extraRial: EXTRA,
            lineNetRial: i.net,
            lineQty: i.qty,
            totalNetRial: TOTAL_NET,
            totalQty: TOTAL_QTY,
            mode,
          }),
        0
      );
      expect(sum, `mode=${mode}`).toBe(EXTRA);
    }
  });

  it("هزینه‌ی صفر یعنی سهم صفر", () => {
    expect(
      allocateExtraCost({
        extraRial: 0,
        lineNetRial: 100,
        lineQty: 1,
        totalNetRial: 1000,
        totalQty: 10,
      })
    ).toBe(0);
  });

  it("🔴 هیچ ورودی منفی‌ای سهم منفی نمی‌سازد", () => {
    /*
      ⚠️ نسخه‌ی اول این تست ضعیف بود: فقط `extraRial: -5000` را
      می‌سنجید و وقتی `Math.max(0, ...)` را عمداً برداشتم باز سبز
      ماند — چون شرط `extra <= 0` جداگانه صفر برمی‌گرداند.

      ادعای واقعی این است که **هیچ ترکیبی** از ورودی منفی نتیجه‌ی
      منفی ندهد. سهم منفی یعنی قیمت تمام‌شده کمتر از قیمت خرید، که
      سود را دوباره غلط می‌کند.
    */
    const cases = [
      { extraRial: -5000, lineNetRial: 100, lineQty: 1, totalNetRial: 1000, totalQty: 10 },
      { extraRial: 5000, lineNetRial: -100, lineQty: 1, totalNetRial: 1000, totalQty: 10 },
      { extraRial: 5000, lineNetRial: 100, lineQty: -1, totalNetRial: 1000, totalQty: 10 },
      { extraRial: -1, lineNetRial: -1, lineQty: -1, totalNetRial: -1, totalQty: -1 },
    ];
    for (const c of cases) {
      expect(allocateExtraCost(c), JSON.stringify(c)).toBeGreaterThanOrEqual(0);
    }
  });

  it("🔴 ارزش کل صفر تقسیم بر صفر نمی‌دهد", () => {
    /*
      همه‌ی اقلام رایگان (نمونه یا هدیه). باید به by_qty برگردد نه
      اینکه NaN یا Infinity بدهد.
    */
    const out = allocateExtraCost({
      extraRial: 5000,
      lineNetRial: 0,
      lineQty: 1,
      totalNetRial: 0,
      totalQty: 10,
      mode: "by_value",
    });
    expect(out).toBe(500);
    expect(Number.isFinite(out)).toBe(true);
  });

  it("ارزش و تعداد هر دو صفر، صفر می‌دهد", () => {
    expect(
      allocateExtraCost({
        extraRial: 5000,
        lineNetRial: 0,
        lineQty: 0,
        totalNetRial: 0,
        totalQty: 0,
      })
    ).toBe(0);
  });
});

describe("قیمت تمام‌شده‌ی واحد", () => {
  it("🔴 واحدی است نه کل سطر", () => {
    /*
      `cost_price` در sale_items واحدی است. اگر کل سطر را بگذاریم،
      سود کالاهای چندتایی چند برابر غلط می‌شود.
      (۶٬۰۰۰٬۰۰۰ + ۳٬۰۰۰٬۰۰۰) ÷ ۲ = ۴٬۵۰۰٬۰۰۰
    */
    expect(landedUnitCost(6_000_000, 3_000_000, 2)).toBe(4_500_000);
  });

  it("بدون هزینه‌ی جانبی برابر قیمت خالص واحد است", () => {
    expect(landedUnitCost(1_000_000, 0, 5)).toBe(200_000);
  });

  it("تعداد صفر صفر می‌دهد نه Infinity", () => {
    expect(landedUnitCost(1000, 100, 0)).toBe(0);
    expect(Number.isFinite(landedUnitCost(1000, 100, 0))).toBe(true);
  });

  it("ورودی منفی نادیده گرفته می‌شود", () => {
    expect(landedUnitCost(-500, -100, 2)).toBe(0);
  });
});

describe("🔴 مهاجرت ۰۰۴۶ — رفع باگ گزارش سود", () => {
  const sql = readCode("supabase/migrations/0046_landed_cost.sql");

  it("ستون landed_cost اضافه می‌شود", () => {
    expect(sql).toContain("add column if not exists landed_cost bigint not null default 0");
  });

  it("🔴 purchase_price دیگر قیمت خام نمی‌گیرد", () => {
    /*
      این همان خطی است که باگ را رفع می‌کند. پیش از این
      `purchase_price = (it->>'unit_price')::bigint` بود، یعنی
      هزینه‌ی حمل هرگز به قیمت تمام‌شده نمی‌رسید.
    */
    expect(sql).toContain("set purchase_price = v_landed");
    expect(sql).not.toContain("set purchase_price = (it->>'unit_price')::bigint");
  });

  it("هر دو تابع ساخت و ویرایش سرشکن می‌کنند", () => {
    const calls = sql.match(/public\.allocate_extra_cost\(/g) ?? [];
    // یک تعریف + دو فراخوانی (create و update)
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("🔴 امضای create_purchase عوض نشده", () => {
    /*
      درس مهاجرت ۰۰۳۰: `create or replace` روی امضای متفاوت تابع دوم
      می‌سازد و PostgREST نمی‌تواند انتخاب کند (PGRST203) — ثبت خرید
      در کل برنامه از کار می‌افتد.
    */
    expect(sql).not.toContain("drop function if exists public.create_purchase");
    expect(sql).toContain("p_paid_card bigint default null");
  });

  it("قیمت تمام‌شده واحدی محاسبه می‌شود", () => {
    expect(sql).toContain("(v_line_net + v_share)::numeric / (it->>'qty')::int");
  });

  it("🔴 SQL هم همه‌ی ورودی‌های منفی را کف می‌زند", () => {
    /*
      همان باگی که در TypeScript پیدا شد، در SQL هم بود: فقط
      `p_extra` سنجیده می‌شد و `p_line_net` منفی سهم منفی می‌داد.
      دو پیاده‌سازی باید دقیقاً یکی بمانند وگرنه عددی که کاربر پیش
      از ثبت می‌بیند با آنچه ذخیره می‌شود فرق می‌کند.
    */
    /*
      ⚠️ الگوی اول همه‌ی `greatest(coalesce(p_*))`ها را می‌شمرد و
      گاردهای پرداخت (`p_paid`, `p_paid_cash`, `p_paid_card`) را هم
      می‌گرفت — ۸ به‌جای ۵. حالا فقط داخل خودِ تابع سرشکن سنجیده
      می‌شود.
    */
    const fn = sql.slice(
      sql.indexOf("create or replace function public.allocate_extra_cost"),
      sql.indexOf("comment on function public.allocate_extra_cost")
    );
    for (const param of ["p_extra", "p_line_net", "p_line_qty", "p_total_net", "p_total_qty"]) {
      expect(fn, param).toContain(`greatest(coalesce(${param}, 0), 0)`);
    }
  });

  it("unit_price دست‌نخورده می‌ماند", () => {
    // مبنای تسویه با تأمین‌کننده است و نباید عوض شود.
    expect(sql).toContain("(it->>'unit_price')::bigint, v_line_discount, v_line_net, v_landed");
  });
});

describe("رابط کاربری هزینه‌های جانبی", () => {
  const form = readCode("src/shared/panels/PurchaseCreateForm.tsx");

  it("🔴 دیگر p_extra_total صفر ثابت نیست", () => {
    // پیش از این اصلاً نمی‌شد هزینه‌ی حمل وارد کرد.
    expect(form).not.toContain("p_extra_total: 0,");
    expect(form).toContain("p_extra_total: extraRial");
  });

  it("روش سرشکن به هر قلم فرستاده می‌شود", () => {
    expect(form).toContain("alloc: allocMode");
  });

  it("هزینه به جمع اضافه می‌شود نه کم", () => {
    expect(form).toContain("subtotal + extraRial - discountRial");
  });

  it("انتخاب روش فقط وقتی هزینه هست نشان داده می‌شود", () => {
    // دو دکمه‌ی بی‌اثر وقتی هزینه صفر است، فقط شلوغی می‌سازد.
    expect(form).toContain("extraRial > 0 &&");
  });

  it("هر دو روش با aria-pressed مشخص‌اند", () => {
    expect(form).toContain("aria-pressed={allocMode === m.id}");
  });

  it("هیچ کلاس پالت خام یا hex ندارد", () => {
    const block = form.slice(form.indexOf("هزینه‌های جانبی"));
    expect(block).not.toMatch(
      /\b(?:bg|text|border)-(?:white|black|slate|rose|emerald|sky|amber|zinc|gray|red|green|blue)(?:\/|-)/
    );
  });
});
