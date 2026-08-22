import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  batchTokens,
  canCreateBatch,
  daysLeftText,
  EXPIRY_META,
  expiryLevel,
  sortForConsumption,
  summarizeExpiry,
} from "@/lib/batches";

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

describe("سطح انقضا", () => {
  /*
    🔴 `null` یعنی «تاریخ ندارد» نه «امروز منقضی می‌شود».
    اگر تهی را صفر می‌گرفتیم، هر کالای بدون تاریخ در گزارش قرمز
    می‌شد و گزارش بی‌فایده می‌گشت.
  */
  it("نبود تاریخ با انقضای امروز یکی نیست", () => {
    expect(expiryLevel(null)).toBe("none");
    expect(expiryLevel(undefined)).toBe("none");
    expect(expiryLevel(0)).toBe("critical");
  });

  it("گذشته منقضی است", () => {
    expect(expiryLevel(-1)).toBe("expired");
    expect(expiryLevel(-100)).toBe("expired");
  });

  it("مرزها درست‌اند", () => {
    expect(expiryLevel(7)).toBe("critical");
    expect(expiryLevel(8)).toBe("warning");
    expect(expiryLevel(30)).toBe("warning");
    expect(expiryLevel(31)).toBe("ok");
  });

  it("ورودی خراب خطا نمی‌دهد", () => {
    expect(expiryLevel(NaN)).toBe("none");
    expect(expiryLevel(Infinity)).toBe("none");
  });

  it("هر سطح برچسب و لحن دارد", () => {
    for (const k of ["expired", "critical", "warning", "ok", "none"] as const) {
      expect(EXPIRY_META[k].label.length).toBeGreaterThan(2);
      expect(EXPIRY_META[k].tone).toBeTruthy();
    }
  });
});

describe("متن روزهای باقی‌مانده", () => {
  it("امروز، آینده و گذشته متن متفاوت دارند", () => {
    expect(daysLeftText(0)).toBe("امروز");
    expect(daysLeftText(5)).toBe("5 روز");
    expect(daysLeftText(-3)).toBe("3 روز گذشته");
  });

  it("نبود تاریخ خط تیره می‌شود", () => {
    expect(daysLeftText(null)).toBe("—");
    expect(daysLeftText(undefined)).toBe("—");
  });
});

describe("برچسب بچ", () => {
  /*
    🔴 دو توکن جدا برمی‌گردد نه یک رشته.
    رشته‌ی `${سری} · ${تاریخ}` در RTL بازچینش می‌شود و اعداد به هم
    می‌چسبند. این خانواده‌باگ چند بار تکرار شده، پس خود تابع هم
    اجازه‌ی ساختنش را نمی‌دهد.
  */
  it("توکن‌ها جدا برمی‌گردند نه رشته‌ی به‌هم‌چسبیده", () => {
    const t = batchTokens({ lot_no: "A1", expiry_date: "1405-06-01" });
    expect(Array.isArray(t)).toBe(true);
    expect(t).toHaveLength(2);
    expect(t.join("")).not.toContain("·");
  });

  it("بچ بدون سری فقط تاریخ می‌دهد", () => {
    expect(batchTokens({ expiry_date: "1405-06-01" })).toHaveLength(1);
  });

  it("بچ خالی هیچ توکنی نمی‌دهد", () => {
    expect(batchTokens({})).toHaveLength(0);
    expect(batchTokens({ lot_no: "   " })).toHaveLength(0);
  });
});

describe("اعتبار ساخت بچ", () => {
  it("سری یا تاریخ کافی است", () => {
    expect(canCreateBatch({ lotNo: "A1" })).toBe(true);
    expect(canCreateBatch({ expiry: "1405-06-01" })).toBe(true);
  });

  /* بچ بدون هویت قابل استفاده نیست — همان محدودیت دیتابیس. */
  it("هیچ‌کدام یعنی نامعتبر", () => {
    expect(canCreateBatch({})).toBe(false);
    expect(canCreateBatch({ lotNo: "  ", expiry: "" })).toBe(false);
  });
});

describe("ترتیب مصرف (FEFO)", () => {
  /*
    🔴 چرا FEFO و نه FIFO؟
    در کالای تاریخ‌دار «اولین ورودی» مهم نیست؛ «اولین انقضا» مهم
    است. بچی که دیرتر خریده شده ولی زودتر منقضی می‌شود باید اول
    فروخته شود، وگرنه روی دست می‌ماند.
  */
  it("زودترین انقضا اول می‌آید", () => {
    const sorted = sortForConsumption([
      { expiry_date: "1405-12-01" },
      { expiry_date: "1405-06-01" },
      { expiry_date: "1405-09-01" },
    ]);
    expect(sorted.map((b) => b.expiry_date)).toEqual([
      "1405-06-01",
      "1405-09-01",
      "1405-12-01",
    ]);
  });

  /* نبود تاریخ یعنی فوریتی ندارد، پس آخر می‌آید. */
  it("بچ بدون تاریخ آخر می‌آید نه اول", () => {
    const sorted = sortForConsumption([
      { expiry_date: null },
      { expiry_date: "1405-06-01" },
    ]);
    expect(sorted[0].expiry_date).toBe("1405-06-01");
    expect(sorted[1].expiry_date).toBeNull();
  });

  it("آرایه‌ی ورودی دست‌نخورده می‌ماند", () => {
    const input = [{ expiry_date: "1405-12-01" }, { expiry_date: "1405-06-01" }];
    sortForConsumption(input);
    expect(input[0].expiry_date).toBe("1405-12-01");
  });
});

describe("خلاصه‌ی وضعیت", () => {
  /*
    بچ تمام‌شده‌ی منقضی هیچ اهمیتی ندارد و فقط عدد را بی‌معنا بزرگ
    می‌کند.
  */
  it("بچ بدون موجودی شمرده نمی‌شود", () => {
    const s = summarizeExpiry([
      { days_left: -5, qty: 0 },
      { days_left: -5, qty: 3 },
    ]);
    expect(s.expired).toBe(1);
  });

  it("هر سطح جدا شمرده می‌شود", () => {
    const s = summarizeExpiry([
      { days_left: -1, qty: 1 },
      { days_left: 3, qty: 1 },
      { days_left: 20, qty: 1 },
      { days_left: 90, qty: 1 },
      { days_left: null, qty: 1 },
    ]);
    expect(s).toMatchObject({ expired: 1, critical: 1, warning: 1, total: 3 });
  });

  it("فهرست خالی صفر می‌دهد", () => {
    expect(summarizeExpiry([]).total).toBe(0);
  });
});

describe("همسانی با مهاجرت ۰۰۵۳", () => {
  const sql = readCode("supabase/migrations/0053_batches_and_expiry.sql");

  /*
    🔴 مهم‌ترین ادعای معماری این فایل.

    وسوسه این است که جدولی مثل batch_stock(batch_id, qty) بسازیم.
    ولی آن‌وقت دو منبع حقیقت داریم که باید همیشه با هم بخوانند، و
    هر جا یکی به‌روز شود و دیگری نه، موجودی کل با موجودی بچ‌ها فرق
    می‌کند و هیچ‌کس نمی‌فهمد کدام درست است.
  */
  it("جدول موازی موجودی بچ ساخته نشده", () => {
    expect(sql).not.toMatch(/create table[^;]*batch_stock/);
    expect(sql).not.toMatch(/product_batches[\s\S]{0,400}\bqty\b\s+(numeric|int)/);
  });

  it("موجودی بچ از جمع حرکت‌ها محاسبه می‌شود", () => {
    expect(sql).toMatch(/create or replace view public\.v_batch_stock/);
    expect(sql).toMatch(/coalesce\(sum\(m\.qty\), 0\)/);
    expect(sql).toMatch(/left join public\.stock_movements m on m\.batch_id = b\.id/);
  });

  /*
    نما باید security_invoker باشد وگرنه RLS دور زده می‌شود و هر
    کاربر بچ‌های سازمان‌های دیگر را می‌بیند.
  */
  it("نما security_invoker دارد", () => {
    expect(sql).toMatch(/create or replace view public\.v_batch_stock\s*\n?with \(security_invoker = true\)/);
  });

  /*
    ⚠️ set null نه cascade: حذف یک بچ نباید تاریخچه‌ی انبار را پاک
    کند. حرکت می‌ماند، فقط دیگر به بچ نمی‌چسبد.
  */
  it("حذف بچ تاریخچه‌ی انبار را پاک نمی‌کند", () => {
    expect(sql).toMatch(
      /stock_movements\s+add column if not exists batch_id uuid references public\.product_batches\(id\) on delete set null/
    );
    expect(sql).not.toMatch(/batch_id uuid references public\.product_batches\(id\) on delete cascade/);
  });

  /*
    دو ردیف با همان سری و همان انقضا یعنی دو «بچ» که در واقع یکی‌اند.
    coalesce لازم است چون در Postgres دو NULL برابر نیستند.
  */
  it("بچ تکراری با ایندکس یکتا جلویش گرفته شده", () => {
    expect(sql).toMatch(/create unique index if not exists uq_batch_identity/);
    expect(sql).toMatch(/coalesce\(lot_no, ''\)/);
    expect(sql).toMatch(/coalesce\(expiry_date, '9999-12-31'::date\)/);
  });

  it("بچ بدون سری و بدون تاریخ رد می‌شود", () => {
    expect(sql).toMatch(/constraint batch_needs_identity check \(lot_no is not null or expiry_date is not null\)/);
  });

  /*
    تاریخ تهی باید null بدهد نه صفر: «بدون تاریخ» با «امروز منقضی
    می‌شود» زمین تا آسمان فرق دارد.
  */
  it("روز باقی‌مانده برای تاریخ تهی، تهی است", () => {
    expect(sql).toMatch(/case when b\.expiry_date is null then null/);
  });

  /* بچ تمام‌شده فقط گزارش را شلوغ می‌کند. */
  it("گزارش انقضا فقط بچ دارای موجودی را می‌آورد", () => {
    expect(sql).toMatch(/and s\.qty > 0/);
  });

  it("توابع گارد سازمان دارند", () => {
    expect(sql).toMatch(/expiring_batches[\s\S]{0,600}p_org in \(select public\.user_org_ids\(\)\)/);
    expect(sql).toMatch(/upsert_batch[\s\S]{0,600}p_org in \(select public\.user_org_ids\(\)\)/);
  });

  /*
    کاربر همان سری را دوباره می‌خرد. اگر هر بار بچ تازه می‌ساختیم،
    فهرست پر می‌شد از ردیف‌های تکراری با موجودی خرد.
  */
  it("upsert بچ موجود را برمی‌گرداند نه ردیف تازه", () => {
    expect(sql).toMatch(/if v_id is not null then\s+return v_id;/);
  });

  it("جدول بچ RLS دارد", () => {
    expect(sql).toMatch(/alter table public\.product_batches enable row level security/);
    expect(sql).toMatch(/create policy product_batches_policy/);
  });

  it("فایل بازگشت وجود دارد و هشدار می‌دهد", () => {
    const down = read("supabase/rollbacks/0053_batches_and_expiry.down.sql");
    expect(down).toMatch(/drop table if exists public\.product_batches/);
    expect(down).toMatch(/هشدار/);
  });
});

describe("مرز سرور و کلاینت", () => {
  /*
    ⚠️ این فایل از کامپوننت کلاینت خوانده می‌شود. همان درسی که با
    node:crypto گرفتیم و فقط next build گرفتش.
  */
  it("منطق بچ هیچ وابستگی به node ندارد", () => {
    const code = readCode("lib/batches.ts");
    expect(code).not.toMatch(/from "node:/);
    expect(code).not.toMatch(/require\(/);
  });
});

describe("اتصال بچ به جریان خرید", () => {
  const sql = readCode("supabase/migrations/0054_purchase_batches.sql");
  const pos = readCode("app/(app)/sales/components/PosPieces.tsx");
  const form = readCode("src/shared/panels/PurchaseCreateForm.tsx");

  /*
    🔴 بدون این، مهاجرت ۰۰۵۳ نیمه‌کاره بود: جدول بچ وجود داشت ولی
    هیچ راهی برای پر کردنش از جریان عادی کار نبود، پس گزارش انقضا
    همیشه خالی می‌ماند.
  */
  it("تابع خرید بچ را داخل همان تراکنش می‌سازد", () => {
    expect(sql).toMatch(/insert into public\.product_batches/);
    expect(sql).toMatch(/v_batch/);
  });

  it("قلم خرید و حرکت انبار بچ را نگه می‌دارند", () => {
    expect(sql).toMatch(/insert into public\.purchase_items\([^)]*batch_id/);
    expect(sql).toMatch(/insert into public\.stock_movements\([^)]*batch_id/);
  });

  /*
    کاربر همان سری را دوباره می‌خرد؛ بدون جستجوی قبلی، فهرست پر
    می‌شد از ردیف‌های تکراری با موجودی خرد.
  */
  it("بچ موجود دوباره ساخته نمی‌شود", () => {
    expect(sql).toMatch(/select id into v_batch from public\.product_batches/);
    expect(sql).toMatch(/if v_batch is null then\s+insert into public\.product_batches/);
  });

  /*
    ⚠️ تغییر امضا در Postgres یک overload تازه می‌سازد و PostgREST
    خطای PGRST203 می‌دهد. بچ باید داخل p_items بیاید.
  */
  it("امضای تابع خرید عوض نشده", () => {
    expect(sql).toMatch(/p_items jsonb/);
    expect(sql).not.toMatch(/p_lot_no|p_expiry_date/);
  });

  /*
    منطق موجود نباید از دست برود — تعریف از pg_get_functiondef
    گرفته شد نه از فایل مهاجرت قدیمی.
  */
  it("تخفیف سطری و سرشکن هزینه حفظ شده‌اند", () => {
    expect(sql).toMatch(/v_line_discount/);
    expect(sql).toMatch(/allocate_extra_cost|v_landed/);
  });

  /* مقدار اعشاری از مهاجرت ۰۰۴۹ نباید برگردد به int. */
  it("مقدار اعشاری حفظ شده", () => {
    expect(sql).not.toMatch(/qty'\)::int\b/);
    expect(sql).toMatch(/qty'\)::numeric/);
  });

  /*
    فروش و مرجوعی بچ نمی‌گیرند: در فروش بچ باید از موجودی انتخاب
    شود نه تایپ، و آن یک قابلیت جداست.
  */
  it("ردیف بچ فقط در خرید رندر می‌شود", () => {
    expect(pos).toMatch(/isPurchase && onBatchChange &&/);
  });

  it("فرم خرید بچ را به سبد و سپس به تابع می‌فرستد", () => {
    expect(form).toMatch(/onBatchChange=\{updateBatch\}/);
    expect(form).toMatch(/lot_no: c\.lot_no \?\? undefined/);
    expect(form).toMatch(/expiry_date: c\.expiry_date \?\? undefined/);
  });

  /*
    ⚠️ بچ فقط روی سبد می‌نشیند؛ ساختش هنگام ثبت فاکتور است. اگر
    در لحظه‌ی تایپ ساخته می‌شد، کاربری که فاکتور را رها می‌کند یک
    بچ یتیم بدون حرکت انبار به‌جا می‌گذاشت.
  */
  it("بچ در لحظه‌ی تایپ ساخته نمی‌شود", () => {
    expect(form).toMatch(/function updateBatch[\s\S]{0,200}setCart/);
    expect(form).not.toMatch(/function updateBatch[\s\S]{0,300}upsert_batch/);
  });
});

describe("صفحه‌ی گزارش انقضا", () => {
  const page = readCode("app/(app)/inventory/expiry/page.tsx");

  it("از تابع دیتابیس استفاده می‌کند", () => {
    expect(page).toMatch(/rpc\("expiring_batches"/);
  });

  it("خطای دیتابیس بررسی می‌شود", () => {
    expect(page).toMatch(/if \(e\) throw e/);
  });

  /*
    خانواده‌باگ تکرارشونده: توکن‌های عددی کنار هم در RTL به هم
    می‌چسبند.
  */
  it("توکن‌ها span جدا با جداکننده‌ی aria-hidden دارند", () => {
    expect(page).toMatch(/aria-hidden="true">·</);
  });

  it("در منو ثبت شده", () => {
    expect(readCode("components/shared/sidebar.tsx")).toMatch(/\/inventory\/expiry/);
  });
});
