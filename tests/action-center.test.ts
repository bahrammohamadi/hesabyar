import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  normalizeActionCenter,
  totalActionCount,
  groupUrgency,
  daysUntil,
  dueLabel,
  isStaleInvoice,
  STALE_INVOICE_DAYS,
  EMPTY_ACTION_CENTER,
} from "@/lib/action-center";
import { toFaDigits } from "@/lib/utils/format";

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

describe("🔴 نرمال‌سازی — داشبورد نباید با داده‌ی خراب بشکند", () => {
  /*
    کلاینت Supabase برای خطای دیتابیس استثنا پرتاب نمی‌کند؛ خطا در
    `error` است و `data` می‌تواند null باشد. بدون normalize،
    `data.checks_overdue.length` کل صفحه را می‌شکست.
  */
  it("null و undefined به ساختار خالی تبدیل می‌شوند", () => {
    expect(normalizeActionCenter(null)).toEqual(EMPTY_ACTION_CENTER);
    expect(normalizeActionCenter(undefined)).toEqual(EMPTY_ACTION_CENTER);
  });

  it("انواع بی‌ربط هم نمی‌شکنند", () => {
    expect(normalizeActionCenter("خطا")).toEqual(EMPTY_ACTION_CENTER);
    expect(normalizeActionCenter(42)).toEqual(EMPTY_ACTION_CENTER);
    expect(normalizeActionCenter([])).toEqual(EMPTY_ACTION_CENTER);
  });

  it("کلید ناقص یا غیرآرایه، آرایه‌ی خالی می‌شود", () => {
    const out = normalizeActionCenter({ checks_overdue: null, unpaid_invoices: "x" });
    expect(out.checks_overdue).toEqual([]);
    expect(out.unpaid_invoices).toEqual([]);
    expect(out.out_of_stock).toEqual([]);
  });

  it("داده‌ی درست دست‌نخورده رد می‌شود", () => {
    const row = { id: "a", type: "received", amount: 1000, due_date: "2026-01-01" };
    const out = normalizeActionCenter({ checks_overdue: [row] });
    expect(out.checks_overdue).toHaveLength(1);
    expect(out.checks_overdue[0].amount).toBe(1000);
  });
});

describe("شمارش کل", () => {
  it("همه‌ی گروه‌ها را جمع می‌زند", () => {
    const d = normalizeActionCenter({
      checks_overdue: [1, 2],
      checks_soon: [1],
      unpaid_invoices: [1, 2, 3],
      out_of_stock: [1],
      pending_orders: [],
    });
    expect(totalActionCount(d)).toBe(7);
  });

  it("خالی صفر می‌دهد", () => {
    expect(totalActionCount(EMPTY_ACTION_CENTER)).toBe(0);
  });
});

describe("فوریت گروه‌ها", () => {
  it("🔴 چک سررسیدگذشته بالاترین فوریت است", () => {
    // چک برگشتی عواقب قانونی دارد؛ نباید هم‌رنگ «سفارش در انتظار» باشد.
    expect(groupUrgency("checks_overdue")).toBe("danger");
  });

  it("چک نزدیک و کالای تمام‌شده هشدارند", () => {
    expect(groupUrgency("checks_soon")).toBe("warning");
    expect(groupUrgency("out_of_stock")).toBe("warning");
  });

  it("فاکتور و سفارش صرفاً اطلاع‌رسانی‌اند", () => {
    expect(groupUrgency("unpaid_invoices")).toBe("info");
    expect(groupUrgency("pending_orders")).toBe("info");
  });
});

describe("🔴 فاصله‌ی سررسید — گرد شدن به روز", () => {
  const now = new Date(2026, 4, 20, 14, 0, 0); // ۲۰ اردیبهشت، ۲ بعدازظهر

  it("سررسید امروز صفر است حتی اگر ساعتش گذشته باشد", () => {
    /*
      بدون گردکردن به نیمه‌شب، چکی که امروز ساعت ۹ صبح سررسید شده
      «۱- روز» می‌شد در حالی که کاربر انتظار «امروز» دارد.
    */
    expect(daysUntil(new Date(2026, 4, 20, 9, 0, 0), now)).toBe(0);
    expect(daysUntil(new Date(2026, 4, 20, 23, 59, 0), now)).toBe(0);
  });

  it("فردا و دیروز درست محاسبه می‌شوند", () => {
    expect(daysUntil(new Date(2026, 4, 21, 1, 0, 0), now)).toBe(1);
    expect(daysUntil(new Date(2026, 4, 19, 23, 0, 0), now)).toBe(-1);
  });

  it("تاریخ نامعتبر صفر می‌دهد نه NaN", () => {
    expect(daysUntil("چیز عجیب", now)).toBe(0);
    expect(Number.isNaN(daysUntil("", now))).toBe(false);
  });
});

describe("متن فارسی سررسید", () => {
  it("حالت‌های خاص متن مخصوص دارند", () => {
    expect(dueLabel(0, toFaDigits)).toBe("امروز");
    expect(dueLabel(1, toFaDigits)).toBe("فردا");
    expect(dueLabel(-1, toFaDigits)).toBe("دیروز");
  });

  it("🔴 هیچ رقم لاتینی در خروجی نیست", () => {
    // درس نمودارها: محور «0k · 1.7M» نشان می‌داد.
    for (const d of [2, 5, 30, -3, -45]) {
      expect(dueLabel(d, toFaDigits)).not.toMatch(/[0-9]/);
    }
  });

  it("گذشته و آینده از هم تفکیک می‌شوند", () => {
    expect(dueLabel(5, toFaDigits)).toContain("دیگر");
    expect(dueLabel(-5, toFaDigits)).toContain("گذشته");
  });
});

describe("فاکتور نسیه‌ی کهنه", () => {
  it("مرز سی روز است", () => {
    expect(STALE_INVOICE_DAYS).toBe(30);
    expect(isStaleInvoice(29)).toBe(false);
    expect(isStaleInvoice(30)).toBe(true);
    expect(isStaleInvoice(100)).toBe(true);
  });
});

describe("🔴 مهاجرت — هشدار باید کم‌نویز باشد", () => {
  const sql = readCode("supabase/migrations/0043_action_center.sql");

  it("کالای تمام‌شده فقط وقتی می‌آید که سابقه‌ی فروش دارد", () => {
    /*
      بدون این شرط، ۳۶۱ از ۳۸۶ تنوع در فهرست می‌آمدند (۹۴٪ کاتالوگ)
      چون ۳۴۴ تای آن‌ها موجودی صفر دارند. اندازه‌گیری روی داده‌ی زنده:
        با شرط    → ۱۱ مورد
        بدون شرط  → ۳۶۱ مورد
      هشداری که ۹۴٪ را قرمز کند، نویز است نه هشدار.
    */
    expect(sql).toContain("exists (select 1 from public.sale_items si where si.variant_id = v.id)");
  });

  it("از نمای پرنویز low_stock_variants استفاده نمی‌کند", () => {
    expect(sql).not.toContain("low_stock_variants");
  });

  it("🔴 عضویت سازمان چک می‌شود", () => {
    // security definer بدون این چک یعنی هر کاربری داده‌ی هر سازمانی را می‌بیند.
    expect(sql).toContain("user_org_ids()");
    expect(sql).toContain("دسترسی غیرمجاز");
    const guardAt = sql.indexOf("user_org_ids()");
    const firstQueryAt = sql.indexOf("jsonb_build_object");
    expect(guardAt).toBeLessThan(firstQueryAt);
  });

  it("دسترسی از anon گرفته شده", () => {
    expect(sql).toContain("revoke all on function public.action_center(uuid, int) from public, anon");
    expect(sql).toContain("grant execute on function public.action_center(uuid, int) to authenticated");
  });

  it("بازه‌ی روز محدود می‌شود تا کوئری سنگین نسازد", () => {
    // p_days=100000 نباید کل تاریخ را اسکن کند.
    expect(sql).toMatch(/greatest\(1,\s*least\(coalesce\(p_days,\s*7\),\s*90\)\)/);
  });

  it("هر گروه سقف تعداد دارد", () => {
    // بدون limit، سازمانی با هزار فاکتور نسیه پاسخ چندمگابایتی می‌گرفت.
    const limits = sql.match(/limit 20/g) ?? [];
    expect(limits.length).toBe(5);
  });

  it("شاخص سررسید چک ساخته می‌شود", () => {
    expect(sql).toContain("idx_checks_due_status");
  });
});

describe("ویجت داشبورد", () => {
  const tsx = readCode("app/(app)/dashboard/components/DashboardActionCenter.tsx");
  const page = readCode("app/(app)/dashboard/page.tsx");

  it("در داشبورد رندر می‌شود", () => {
    expect(page).toContain("<DashboardActionCenter");
    expect(page).toContain('supabase.rpc("action_center"');
  });

  it("🔴 بالاتر از هشدار موجودی قدیمی است", () => {
    // قابل‌اقدام‌تر است: چک سررسیدگذشته عواقب قانونی دارد.
    const acAt = page.indexOf("<DashboardActionCenter");
    const saAt = page.indexOf("<DashboardStockAlert");
    expect(acAt).toBeGreaterThan(-1);
    expect(saAt).toBeGreaterThan(-1);
    expect(acAt).toBeLessThan(saAt);
  });

  it("خروجی RPC نرمال‌سازی می‌شود", () => {
    expect(page).toContain("normalizeActionCenter(data)");
  });

  it("هر سطر لینک دارد", () => {
    /*
      هشداری که نشود رویش کاری کرد فقط اضطراب می‌سازد. هر گروه باید
      به صفحه‌ی مربوطه ببرد.
    */
    expect(tsx).toContain('href="/checks"');
    expect(tsx).toContain("/sales/${s.id}");
    expect(tsx).toContain('href="/sales/orders"');
  });

  it("حالت خالی مثبت است نه کادر خالی", () => {
    expect(tsx).toContain("همه‌چیز مرتب است");
  });

  it("ارقام فارسی‌اند و مبلغ از formatToman می‌آید", () => {
    expect(tsx).toContain("toFaDigits");
    expect(tsx).toContain("formatToman");
    // تاریخ شمسی، نه میلادی
    expect(tsx).toContain("toJalali");
  });

  it("🔴 تاریخ و عدد روز در دو عنصر جدا هستند نه یک رشته", () => {
    /*
      باگ واقعی که فقط از روی اسکرین‌شات پیدا شد:
      رشته‌ی «۱۴۰۵/۰۴/۰۶ · ۴۴ روز پیش» را الگوریتم bidi در متن
      راست‌به‌چپ بازچینش می‌کرد و روی صفحه «۴۴۰۱۴۰۵/۰۴/۰۶ روز پیش»
      دیده می‌شد — عدد روز به تاریخ چسبیده بود.

      در DOM متن درست است، پس هیچ تست رشته‌ای روی محتوا نمی‌گیردش.
      تنها ادعای قابل‌اتکا این است که «·» داخل template literal
      نباشد و هر تکه ظرف مستقل خودش را داشته باشد.

      همان باگی که یک بار در خلاصه‌ی عددی نمودار داشبورد گرفتیم.
    */
    expect(tsx).not.toMatch(/subtitle=\{`[^`]*·[^`]*`\}/);
    expect(tsx).toContain("meta=");
    // جداکننده باید span مستقل و aria-hidden باشد
    expect(tsx).toMatch(/<span aria-hidden className="shrink-0 opacity-50">·<\/span>/);
  });

  it("هیچ کلاس پالت خام یا hex ندارد", () => {
    expect(tsx).not.toMatch(
      /\b(?:bg|text|border)-(?:white|black|slate|rose|emerald|sky|amber|zinc|gray|red|green|blue)(?:\/|-)/
    );
    expect(tsx).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});
