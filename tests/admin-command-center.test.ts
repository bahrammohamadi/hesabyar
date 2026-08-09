import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABEL,
  MIN_REASON_LENGTH,
  isReasonValid,
} from "@/lib/admin/invoices";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

/**
 * 🔴 تله‌ی تکرارشونده: ادعاهای تست روی *توضیحات فارسی* گیر می‌کنند نه
 * روی کد. مثلاً اگر توضیح بنویسیم «قبلاً security_invoker بود» و بعد
 * assert کنیم که فایل شامل "security_invoker" نیست، تست به‌خاطر
 * کامنت می‌شکند — یا بدتر، به‌خاطر کامنت پاس می‌شود در حالی که کد
 * غلط است. پس همیشه پیش از assert، توضیحات حذف می‌شوند.
 */
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*(\/\/|--).*$/gm, "");

const MIG = "supabase/migrations/0039_admin_command_center.sql";
const migCode = readCode(MIG);

describe("مهاجرت ۰۰۳۹ — ساختار", () => {
  it("مجوزهای تازه در کاتالوگ ثبت می‌شوند", () => {
    expect(migCode).toContain("('system.health'");
    expect(migCode).toContain("('errors.view'");
  });

  it("مجوزهای تازه در ماتریس تعریف شده‌اند", () => {
    expect(migCode).toContain("when 'system.health'");
    expect(migCode).toContain("when 'errors.view'");
  });

  it("🔴 هیچ سطری از ماتریس قبلی جا نیفتاده", () => {
    /*
      این تابع تا امروز در ۰۰۲۸، ۰۰۳۱، ۰۰۳۳، ۰۰۳۶ و ۰۰۳۷ بازنویسی
      شده و دو بار سطرهایی در بازنویسی گم شده‌اند:
        • ۰۰۳۱ → users.view, impersonate, announcements.manage
        • ۰۰۳۳ → tickets.reply (اندازه‌گیری زنده: false برای مدیر ارشد)
      هر بار فقط روی سایت زنده کشف شد، نه در بیلد.
    */
    for (const perm of [
      "orgs.view", "audit.view", "orgs.approve", "orgs.suspend",
      "trial.extend", "plan.change", "invoice.view", "invoice.modify",
      "admins.manage", "users.view", "impersonate", "announcements.manage",
      "users.password", "tickets.view", "tickets.reply", "data.import",
    ]) {
      expect(migCode, `مجوز ${perm} از ماتریس افتاده`).toContain(`when '${perm}'`);
    }
  });

  it("گارد NULL حفظ شده", () => {
    // NULL not in (...) نتیجه‌اش NULL است نه TRUE — درس ۰۰۲۸.
    expect(migCode).toContain("if v_role is null then");
  });

  it("نقش سفارشی فقط از آرایه می‌خواند", () => {
    expect(migCode).toContain("if v_role = 'custom' then");
  });
});

describe("🔴 نماهای ادمین باید definer باشند", () => {
  /*
    auth.users به هیچ نقشی SELECT نمی‌دهد، حتی service_role. ولی
    اینجا مسئله فرق دارد: v_admin_invoices به auth.users دست نمی‌زند،
    بلکه به sales که RLS دارد. با security_invoker، سوپرادمین — که
    عضو سازمان مشتری نیست — همیشه صفر ردیف می‌گرفت.

    این دقیقاً همان دسته اشتباهی است که در ۰۰۲۸، ۰۰۳۲، ۰۰۳۵ و ۰۰۳۶
    تکرار شد.
  */
  it.each(["v_admin_invoices", "v_admin_invoice_items"])(
    "نمای %s با security_invoker ساخته نشده",
    (view) => {
      const idx = migCode.indexOf(`create view public.${view}`);
      expect(idx).toBeGreaterThan(-1);
      // ۲۰۰ نویسه بعدِ create view نباید شامل security_invoker باشد.
      expect(migCode.slice(idx, idx + 200)).not.toContain("security_invoker");
    }
  );

  it.each(["v_admin_invoices", "v_admin_invoice_items"])(
    "نمای %s از anon و authenticated گرفته می‌شود",
    (view) => {
      expect(migCode).toContain(`revoke all on public.${view} from anon, authenticated`);
      expect(migCode).toContain(`grant select on public.${view} to service_role`);
    }
  );
});

describe("🔴 ابطال فاکتور — منطق مشترک، نه کپی", () => {
  it("مکانیک ابطال در یک تابع مشترک است", () => {
    /*
      دو نسخه از منطق برگشت موجودی یعنی روزی یکی اصلاح می‌شود و
      دیگری نه، و آن‌وقت موجودی انبار بسته به اینکه *چه کسی* فاکتور
      را باطل کرده فرق می‌کند.
    */
    expect(migCode).toContain("create or replace function public.apply_sale_cancellation");
    expect(migCode).toContain("perform public.apply_sale_cancellation(p_sale, v_uid, p_reason)");
    expect(migCode).toContain("v_changed := public.apply_sale_cancellation(");
  });

  it("🔴 تابع مکانیک به هیچ نقش عمومی grant نشده", () => {
    /*
      این تابع *هیچ* بررسی دسترسی ندارد. اگر به authenticated grant
      می‌شد، هر کاربر واردشده‌ای می‌توانست فاکتور هر کسب‌وکار دیگری را
      با یک فراخوانی PostgREST باطل کند.
      (اندازه‌گیری زنده: has_function_privilege('authenticated', ...) → false)
    */
    expect(migCode).toContain(
      "revoke all on function public.apply_sale_cancellation(uuid, uuid, text) from public, anon, authenticated"
    );
  });

  it("admin_cancel_sale مجوز invoice.modify را می‌خواهد", () => {
    expect(migCode).toContain("platform_admin_can('invoice.modify', p_actor)");
  });

  it("🔴 actor تهی رد می‌شود", () => {
    /*
      SQL: `NULL not in (...)` نتیجه NULL است نه TRUE. بدون بررسی
      صریح p_actor is null، فراخوانی بدون هویت از گارد رد می‌شد.
    */
    expect(migCode).toContain("if p_actor is null or not public.platform_admin_can");
  });

  it("دلیل اجباری است", () => {
    expect(migCode).toContain("length(trim(coalesce(p_reason, ''))) < 5");
  });

  it("ابطال در ممیزی ثبت می‌شود", () => {
    expect(migCode).toContain("'invoice.cancel'");
    expect(migCode).toContain("perform public.log_platform_action(");
  });

  it("ابطال تکراری بی‌اثر است", () => {
    // دو کلیک پشت‌سرهم نباید موجودی را دو بار برگرداند.
    expect(migCode).toContain("if v_sale.status = 'cancelled' then");
    expect(migCode).toContain("return false;");
  });

  it("cancel_sale کاربر عادی هنوز هر دو گارد را دارد", () => {
    // مسیر کاربر عادی نباید با این بازسازی شل شود.
    const idx = migCode.indexOf("create or replace function public.cancel_sale");
    const body = migCode.slice(idx, idx + 1200);
    expect(body).toContain("has_permission('sales.create')");
    expect(body).toContain("user_org_ids()");
  });
});

describe("ثبت خطای سرور", () => {
  it("جدول خطاها RLS دارد", () => {
    expect(migCode).toContain("alter table public.platform_error_logs enable row level security");
  });

  it("🔴 هیچ policy نوشتنی وجود ندارد", () => {
    /*
      با policy insert، هر کاربر واردشده‌ای می‌توانست جدول را با
      ردیف جعلی پر کند و خطاهای واقعی را زیر نویز پنهان کند.
      نوشتن فقط از تابع security definer با service_role.
    */
    expect(migCode).not.toMatch(/create policy[\s\S]{0,120}on public\.platform_error_logs[\s\S]{0,60}for insert/);
    expect(migCode).toContain("for select to authenticated");
  });

  it("خواندن خطاها مجوز errors.view می‌خواهد", () => {
    expect(migCode).toContain("using (public.platform_admin_can('errors.view'))");
  });

  it("طول ورودی‌ها بریده می‌شود", () => {
    // یک stack trace طولانی می‌تواند ده‌ها کیلوبایت باشد.
    expect(migCode).toContain("left(coalesce(p_message, ''), 4000)");
    expect(migCode).toContain("left(coalesce(p_ref, '-'), 40)");
  });

  it("پاک‌سازی کف روز دارد", () => {
    // p_days=0 یعنی حذف همه‌چیز از جمله خطای همین الان.
    expect(migCode).toContain("greatest(coalesce(p_days, 30), 1)");
  });
});

describe("🔴 safeError خطا را ماندگار می‌کند", () => {
  const guard = readCode("lib/security/api-guard.ts");

  it("async است", () => {
    /*
      همه‌ی ۴۸ فراخوان به شکل `return safeError(...)` داخل تابع async
      هستند، پس async شدن هیچ‌کدام را نمی‌شکند. ولی اگر روزی کسی
      safeError را جایی *بدون* return یا در تابع sync صدا بزند،
      Promise معلق می‌ماند و پاسخ هرگز نمی‌رسد.
    */
    expect(guard).toContain("export async function safeError(");
  });

  it("در دیتابیس ثبت می‌کند", () => {
    expect(guard).toContain('rpc("log_platform_error"');
  });

  it("🔴 شکست ثبت، پاسخ کاربر را نمی‌شکند", () => {
    /*
      محتمل‌ترین دلیلِ خطا این است که دیتابیس در دسترس نیست — یعنی
      دقیقاً همان لحظه‌ای که ثبت خطا هم شکست می‌خورد. بدون این
      try/catch، کاربر به‌جای ۵۰۰ تمیز یک استثنای درمان‌نشده می‌گرفت.
    */
    const idx = guard.indexOf("export async function safeError");
    const body = guard.slice(idx, guard.indexOf("\n}", idx));
    expect(body).toContain("try {");
    expect(body).toContain("catch (logError)");
  });

  it("همه‌ی فراخوان‌ها هنوز به شکل return هستند", () => {
    /*
      اگر جایی `safeError(...)` بدون return باشد، حالا یک Promise
      دورافتاده می‌شود و روت بدون پاسخ می‌ماند.
    */
    const dirs = ["app/api", "lib"];
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(join(root, d), { withFileTypes: true })) {
        const rel = `${d}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (e.name.endsWith(".ts")) files.push(rel);
      }
    };
    dirs.forEach(walk);

    for (const f of files) {
      if (f.endsWith("api-guard.ts")) continue;
      const code = readCode(f);
      for (const line of code.split("\n")) {
        if (line.includes("safeError(")) {
          expect(line.trim(), `${f}: فراخوان بدون return`).toMatch(/^return safeError\(/);
        }
      }
    }
  });
});

describe("روت‌های تازه", () => {
  const list = readCode("app/api/admin/invoices/route.ts");
  const detail = readCode("app/api/admin/invoices/[id]/route.ts");
  const system = readCode("app/api/admin/system/route.ts");

  it("مشاهده‌ی فاکتور مجوز invoice.view می‌خواهد", () => {
    expect(list).toContain('requirePlatformPermission("invoice.view")');
    expect(detail).toContain('requirePlatformPermission("invoice.view")');
  });

  it("🔴 ابطال مجوز جداگانه‌ی invoice.modify می‌خواهد", () => {
    // دیدن و دست‌کاری‌کردن دو سطح متفاوت‌اند.
    expect(detail).toContain('requirePlatformPermission("invoice.modify")');
  });

  it("وضعیت فنی مجوز system.health می‌خواهد", () => {
    expect(system).toContain('requirePlatformPermission("system.health")');
  });

  it("🔴 خطاها مجوز جدا دارند و صفحه بدون آن هم کار می‌کند", () => {
    /*
      اگر errors.view را با requirePlatformPermission می‌گرفتیم،
      نقشی که فقط system.health دارد کل صفحه را ۴۰۳ می‌گرفت — در
      حالی که باید بخش سلامت را ببیند.
    */
    expect(system).toContain('p_permission: "errors.view"');
    expect(system).toContain("canSeeErrors");
  });

  it("پاک‌سازی خطا مجوز errors.view می‌خواهد", () => {
    expect(system).toContain('requirePlatformPermission("errors.view")');
  });

  it("🔴 ورودی جستجو از کاراکترهای الگوی LIKE پاک می‌شود", () => {
    /*
      «%» تنها در ilike کل جدول را برمی‌گرداند و کاما نحو فیلتر
      PostgREST را می‌شکند.
    */
    expect(list).toContain("replace(/[%_,()]/g");
    expect(system).toContain("replace(/[%_,()]/g");
  });

  it("🔴 فیلتر بازه از helper مشترک استفاده می‌کند", () => {
    /*
      sales.date از نوع timestamptz است. با lte(to) فاکتورهای خودِ
      روز پایانی از قلم می‌افتند. applyRange به lt(روز بعد) تبدیل
      می‌کند — همان اشتباهی که قبلاً در گزارش‌ها رخ داده بود.
    */
    expect(list).toContain("applyRange(query");
    expect(list).not.toContain('.lte("date"');
  });

  it("ابطال، نرخ درخواست سخت‌گیرانه دارد", () => {
    expect(detail).toContain("limit: 10");
    expect(detail).toContain("blockSeconds: 300");
  });

  it("خطای گارد دیتابیس به کاربر می‌رسد نه ۵۰۰", () => {
    expect(detail).toContain('msg.includes("دسترسی")');
    expect(detail).toContain('msg.includes("دلیل")');
  });

  it("🔴 روت‌ها فقط نام‌های مجاز Next را export می‌کنند", () => {
    /*
      فایل route.ts فقط اجازه‌ی export نام‌های شناخته‌شده دارد.
      هر export دیگر → next build می‌شکند با «X is not a valid Route
      export field»، ولی tsc کاملاً تمیز رد می‌شود. دو بار قبلاً ما
      را گرفته (mapTicket و fileResponse) — به همین دلیل ثابت‌های
      مشترک در lib/admin/invoices.ts هستند.
    */
    const ALLOWED = new Set([
      "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
      "dynamic", "revalidate", "runtime", "maxDuration",
      "preferredRegion", "fetchCache", "dynamicParams",
    ]);
    for (const [name, code] of [
      ["invoices", list], ["invoices/[id]", detail], ["system", system],
    ] as const) {
      for (const m of code.matchAll(/^export\s+(?:async\s+)?(?:function|const)\s+(\w+)/gm)) {
        expect(ALLOWED.has(m[1]), `${name}: export غیرمجاز «${m[1]}»`).toBe(true);
      }
    }
  });
});

describe("رابط کاربری", () => {
  const invoicePage = readCode("app/(app)/admin/invoices/page.tsx");
  const systemPage = readCode("app/(app)/admin/system/page.tsx");
  const sidebar = readCode("components/shared/sidebar.tsx");

  it("هر دو صفحه در سایدبار پلتفرم هستند", () => {
    expect(sidebar).toContain('"/admin/invoices"');
    expect(sidebar).toContain('"/admin/system"');
  });

  it("دکمه‌ی ابطال فقط با مجوز نشان داده می‌شود", () => {
    expect(invoicePage).toContain("canModify");
    expect(invoicePage).toContain('viewerRole === "super_admin"');
  });

  it("🔴 دلیل کوتاه، دکمه را غیرفعال می‌کند", () => {
    // اعتبارسنجی در هر سه لایه: UI، روت، دیتابیس.
    expect(invoicePage).toContain("isReasonValid");
    expect(invoicePage).toContain("disabled={!valid}");
  });

  it("به کاربر گفته می‌شود فاکتور حذف نمی‌شود", () => {
    /*
      کاربر «حذف فاکتور» خواسته بود. صادق بودن درباره‌ی اینکه چه
      کاری واقعاً انجام می‌شود، مهم‌تر از تظاهر به اجرای درخواست است.
    */
    expect(invoicePage).toContain("فاکتور حذف نمی‌شود");
  });

  it("برش نتیجه به کاربر اعلام می‌شود", () => {
    // بدون این، ادمین بر اساس جمعِ ناقص تصمیم می‌گیرد.
    expect(invoicePage).toContain("truncated");
  });

  it("ارقام فارسی و تاریخ شمسی استفاده می‌شود", () => {
    for (const page of [invoicePage, systemPage]) {
      expect(page).toContain("toFaDigits");
      expect(page).toContain("toJalali");
    }
  });

  it("🔴 هیچ کلاس پالت خامی استفاده نشده", () => {
    /*
      فقط توکن‌های معنایی. کلاس پالت مستقیم در حالت تیره می‌شکند و
      از تم مرکزی جدا می‌افتد.
    */
    for (const [name, page] of [["invoices", invoicePage], ["system", systemPage]] as const) {
      expect(page, `${name}: کلاس پالت خام`).not.toMatch(
        /\b(?:bg|text|border)-(?:slate|rose|emerald|sky|amber|zinc|gray|red|green|blue)-\d{2,3}\b/
      );
      expect(page, `${name}: رنگ hex خام`).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    }
  });

  it("متن خام خطا در جهت چپ‌به‌راست نمایش داده می‌شود", () => {
    // پیام‌های Postgres انگلیسی‌اند و در RTL به‌هم می‌ریزند.
    expect(systemPage).toContain('dir="ltr"');
  });
});

describe("کمکی‌های فاکتور", () => {
  it("همه‌ی وضعیت‌ها برچسب فارسی دارند", () => {
    for (const st of INVOICE_STATUSES) {
      expect(INVOICE_STATUS_LABEL[st], `برچسب ${st} نیست`).toBeTruthy();
    }
  });

  it("وضعیت‌ها با قید دیتابیس یکی هستند", () => {
    /*
      قید واقعی روی جدول (اندازه‌گیری‌شده):
      CHECK (status = ANY (ARRAY['draft','confirmed','paid','settled',
                                 'reversed','cancelled','returned']))
      اگر این فهرست از قید جدا بیفتد، فیلتر UI بی‌صدا نتیجه‌ی خالی
      می‌دهد و کاربر فکر می‌کند فاکتوری نیست.
    */
    expect([...INVOICE_STATUSES].sort()).toEqual(
      ["cancelled", "confirmed", "draft", "paid", "returned", "reversed", "settled"]
    );
  });

  it("دلیل کوتاه رد می‌شود", () => {
    expect(isReasonValid("")).toBe(false);
    expect(isReasonValid("   ")).toBe(false);
    expect(isReasonValid("خطا")).toBe(false);
    // فاصله‌ها نباید طول را بالا ببرند.
    expect(isReasonValid("  ab  ")).toBe(false);
    expect(isReasonValid(null)).toBe(false);
    expect(isReasonValid(12345)).toBe(false);
  });

  it("دلیل کافی پذیرفته می‌شود", () => {
    expect(isReasonValid("درخواست مالک کسب‌وکار")).toBe(true);
    expect(isReasonValid("x".repeat(MIN_REASON_LENGTH))).toBe(true);
  });
});

describe("🔴 ارقام فارسی در پیام‌های سرور", () => {
  /*
    در تست HTTP واقعی دیده شد: پیام «ثبت دلیل الزامی است (حداقل 5
    نویسه)» با رقم لاتین برمی‌گشت — تنها رقم لاتین در یک رابط تماماً
    فارسی. `next build` و `tsc` هر دو تمیز بودند.
  */
  it("پیام دلیل کوتاه از toFaDigits استفاده می‌کند", () => {
    const detail = readCode("app/api/admin/invoices/[id]/route.ts");
    expect(detail).toContain("toFaDigits(MIN_REASON_LENGTH)");
    expect(detail).not.toContain("حداقل ${MIN_REASON_LENGTH}");
  });
});
