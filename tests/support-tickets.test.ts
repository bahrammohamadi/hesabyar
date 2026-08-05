import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_HINT,
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABEL,
  TICKET_STATUSES,
  TICKET_STATUS_CUSTOMER,
  TICKET_STATUS_STAFF,
  hasUnreadForCustomer,
  relativeFa,
  validateMessage,
  validateSubject,
} from "@/lib/support/tickets";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

/**
 * کد بدون توضیحات.
 *
 * ⚠️ چند ادعای این فایل ابتدا روی *توضیح فارسی* گیر می‌کردند نه روی کد:
 * جمله‌ی «نسخه‌ی اول `void svc...` بود» باعث می‌شد تستِ «هیچ void‌ی
 * نمانده» بشکند، در حالی که خودِ کد درست بود. یعنی تست غلط مثبت
 * می‌داد — و تست غلط، بدتر از نبودِ تست است چون اعتماد را از بین
 * می‌برد.
 */
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const mig = read("supabase/migrations/0036_support_tickets.sql");

describe("هم‌خوانی ثابت‌ها با قیدهای دیتابیس", () => {
  /*
    ⚠️ اگر این‌ها از هم جدا بیفتند، کاربر گزینه‌ای را در فرم می‌بیند
    که دیتابیس ردش می‌کند — و پیام خطای خام Postgres می‌گیرد.
  */
  it.each([...TICKET_CATEGORIES])("دسته «%s» در قید CHECK هست", (c) => {
    const line = mig.match(/check \(category in \(([^)]+)\)\)/)?.[1] ?? "";
    expect(line).toContain(`'${c}'`);
  });

  it("هیچ دسته‌ای در قید هست که در کد نباشد", () => {
    const line = mig.match(/check \(category in \(([^)]+)\)\)/)?.[1] ?? "";
    const inSql = [...line.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
    expect(inSql).toEqual([...TICKET_CATEGORIES].sort());
  });

  it("همه‌ی وضعیت‌ها برچسب دارند — هم برای مشتری و هم برای پشتیبانی", () => {
    for (const s of TICKET_STATUSES) {
      expect(TICKET_STATUS_CUSTOMER[s]?.label).toBeTruthy();
      expect(TICKET_STATUS_STAFF[s]?.label).toBeTruthy();
    }
  });

  it("همه‌ی دسته‌ها برچسب و راهنما دارند", () => {
    for (const c of TICKET_CATEGORIES) {
      expect(TICKET_CATEGORY_LABEL[c]).toBeTruthy();
      // بدون راهنما کاربر همه‌چیز را «سایر» می‌زند و مسیریابی بی‌فایده می‌شود.
      expect(TICKET_CATEGORY_HINT[c]).toBeTruthy();
    }
  });

  it("همه‌ی اولویت‌ها برچسب دارند", () => {
    for (const p of TICKET_PRIORITIES) expect(TICKET_PRIORITY_LABEL[p]?.label).toBeTruthy();
  });

  it("🔴 برچسب مشتری و پشتیبانی برای pending عمداً فرق دارد", () => {
    /*
      برای ادمین pending یعنی «جواب دادم، منتظر مشتری». اگر همین
      کلمه به مشتری نشان داده شود، «در انتظار» را «هنوز کسی نگاه
      نکرده» می‌فهمد و تیکت تکراری می‌زند.
    */
    expect(TICKET_STATUS_CUSTOMER.pending.label).not.toBe(TICKET_STATUS_STAFF.pending.label);
    expect(TICKET_STATUS_CUSTOMER.pending.label).toContain("پاسخ داده شد");
  });
});

describe("اعتبارسنجی ورودی", () => {
  it("موضوع کوتاه رد می‌شود", () => {
    expect(validateSubject("ا")).toBeTruthy();
    expect(validateSubject("   ")).toBeTruthy();
  });

  it("موضوع معتبر پذیرفته می‌شود", () => {
    expect(validateSubject("گزارش سود اشتباه است")).toBeNull();
  });

  it("موضوع بیش از ۲۰۰ نویسه رد می‌شود", () => {
    expect(validateSubject("ا".repeat(201))).toBeTruthy();
  });

  it("پیام خالی یا فقط فاصله رد می‌شود", () => {
    // trim لازم است؛ بدون آن «     » از سد حداقل طول رد می‌شد.
    expect(validateMessage("     ")).toBeTruthy();
    expect(validateMessage("")).toBeTruthy();
  });

  it("پیام بیش از ۴۰۰۰ نویسه رد می‌شود", () => {
    expect(validateMessage("ا".repeat(4001))).toBeTruthy();
    expect(validateMessage("ا".repeat(4000))).toBeNull();
  });
});

describe("نشانگر خوانده‌نشده", () => {
  it("پیام خودِ مشتری خوانده‌نشده نیست", () => {
    /*
      اگر مبنا فقط «آخرین پیام بعد از آخرین بازدید» بود، کاربر بلافاصله
      بعد از فرستادن پیام خودش، نشان «پاسخ جدید» می‌دید.
    */
    expect(
      hasUnreadForCustomer({
        lastMessageAt: "2026-08-05T10:00:00Z",
        lastMessageBy: "customer",
        customerReadAt: null,
      })
    ).toBe(false);
  });

  it("پاسخ پشتیبانی که هنوز باز نشده، خوانده‌نشده است", () => {
    expect(
      hasUnreadForCustomer({
        lastMessageAt: "2026-08-05T10:00:00Z",
        lastMessageBy: "staff",
        customerReadAt: null,
      })
    ).toBe(true);
  });

  it("پاسخی که بعد از بازدید نیامده، خوانده‌شده است", () => {
    expect(
      hasUnreadForCustomer({
        lastMessageAt: "2026-08-05T10:00:00Z",
        lastMessageBy: "staff",
        customerReadAt: "2026-08-05T11:00:00Z",
      })
    ).toBe(false);
  });

  it("تیکت بدون هیچ پیامی خوانده‌نشده نیست", () => {
    expect(
      hasUnreadForCustomer({ lastMessageAt: null, lastMessageBy: null, customerReadAt: null })
    ).toBe(false);
  });
});

describe("زمان نسبی", () => {
  const now = new Date("2026-08-05T12:00:00Z").getTime();
  const at = (iso: string) => relativeFa(iso, now);

  it("کمتر از یک دقیقه", () => expect(at("2026-08-05T11:59:30Z")).toBe("لحظاتی پیش"));
  it("دقیقه", () => expect(at("2026-08-05T11:45:00Z")).toBe("15 دقیقه پیش"));
  it("ساعت", () => expect(at("2026-08-05T09:00:00Z")).toBe("3 ساعت پیش"));
  it("روز", () => expect(at("2026-08-03T12:00:00Z")).toBe("2 روز پیش"));

  it("بیش از یک هفته null می‌دهد تا تاریخ کامل نمایش داده شود", () => {
    // «۴۵ روز پیش» بی‌فایده است؛ آنجا تاریخ شمسی مفیدتر است.
    expect(at("2026-06-01T12:00:00Z")).toBeNull();
  });

  it("🔴 زمان آینده «منفی دقیقه پیش» نمی‌دهد", () => {
    // ساعت دستگاه کاربر ممکن است جلو باشد.
    expect(at("2026-08-05T12:30:00Z")).toBe("لحظاتی پیش");
  });

  it("ورودی نامعتبر null می‌دهد", () => {
    expect(relativeFa("چرندیات", now)).toBeNull();
    expect(relativeFa(null, now)).toBeNull();
  });
});

describe("🔴 گاردهای امنیتی مهاجرت ۰۰۳۶", () => {
  it("is_staff از ورودی خوانده نمی‌شود", () => {
    /*
      policy موجود فقط عضویت سازمان را چک می‌کرد. بدون این تریگر، یک
      مشتری با یک درخواست ساده به PostgREST می‌توانست پیامی با
      is_staff=true بسازد و در نخ گفتگو به‌جای تیم پشتیبانی حرف بزند.
    */
    expect(mig).toContain("new.is_staff := exists (");
    expect(mig).toContain("from public.platform_admins pa where pa.user_id = new.author_id");
  });

  it("author_id به کاربر واردشده قفل می‌شود", () => {
    expect(mig).toContain("new.author_id := auth.uid()");
  });

  it("created_by تیکت قابل جعل نیست", () => {
    expect(mig).toContain("new.created_by := auth.uid()");
  });

  it("مشتری نمی‌تواند تیکت را به سازمان دیگری منتقل کند", () => {
    // UPDATE برای «بستن تیکت» لازم بود؛ بدون این قید، انتقال هم ممکن می‌شد.
    expect(mig).toContain("new.org_id      := old.org_id");
    expect(mig).toContain("new.assigned_to := old.assigned_to");
  });

  it("مشتری فقط open/closed می‌گذارد", () => {
    expect(mig).toContain("new.status not in ('open', 'closed')");
  });

  it("مسیر service_role از گارد مشتری عبور می‌کند", () => {
    // روت‌های ادمین auth.uid() ندارند؛ گارد آن‌ها در لایه‌ی API است.
    expect(mig).toContain("if auth.uid() is null then");
  });

  it("نمای ادمین security definer است (auth.users)", () => {
    /*
      auth.users به هیچ نقشی SELECT نمی‌دهد، حتی service_role.
      همان درس ۰۰۲۸، ۰۰۳۲ و ۰۰۳۵.
    */
    // فقط تعریف واقعی مهم است، نه ذکر کلمه در توضیح.
    expect(mig).not.toMatch(/with\s*\(\s*security_invoker/i);
    expect(mig).toContain("revoke all on public.v_support_tickets from anon, authenticated");
    expect(mig).toContain("grant select on public.v_support_tickets to service_role");
  });
});

describe("چرخه‌ی وضعیت", () => {
  it("پاسخ پشتیبانی تیکت را pending می‌کند و پیام مشتری open", () => {
    expect(mig).toContain("case when new.is_staff then 'pending' else 'open' end");
  });

  it("🔴 تیکت بسته با پیام تازه‌ی مشتری دوباره باز می‌شود", () => {
    // وگرنه مشتری می‌نویسد و هیچ‌کس خبردار نمی‌شود.
    expect(mig).toContain("when t.status = 'closed' and not new.is_staff then 'open'");
  });

  it("first_response_at فقط یک بار ثبت می‌شود", () => {
    expect(mig).toContain("when new.is_staff and t.first_response_at is null");
  });

  it("نویسنده‌ی پیام برای پیام خودش خوانده‌نشده نمی‌بیند", () => {
    expect(mig).toContain("staff_read_at    = case when new.is_staff then new.created_at");
  });
});

describe("گاردهای روت API", () => {
  const custList = read("app/api/support/tickets/route.ts");
  const custItem = read("app/api/support/tickets/[id]/route.ts");
  const admList = read("app/api/admin/tickets/route.ts");
  const admItem = read("app/api/admin/tickets/[id]/route.ts");

  it("🔴 هر کوئری تیکتِ مشتری org_id را در WHERE دارد", () => {
    /*
      کوئری‌ها با service_role اجرا می‌شوند، یعنی RLS دور زده می‌شود.
      شرط سازمان باید داخل خود WHERE باشد تا «فراموش‌کردن بررسی» به
      نتیجه‌ی خالی ختم شود، نه به نشت داده.
    */
    const code = readCode("app/api/support/tickets/[id]/route.ts");
    expect(code).toContain('.eq("org_id", orgId)');
    // هر UPDATE هم باید همین شرط را داشته باشد
    const updates = code.match(/\.update\(/g)?.length ?? 0;
    const orgGuards = code.match(/\.eq\("org_id", membership\.org_id\)/g)?.length ?? 0;
    expect(orgGuards).toBeGreaterThanOrEqual(updates);
  });

  it("تیکت ناموجود و تیکت غیرمجاز پاسخ یکسان می‌گیرند", () => {
    // تفاوت پاسخ، وجود تیکت را لو می‌دهد.
    expect(custItem).toContain("تیکت یافت نشد");
    expect(custItem).not.toContain("Forbidden");
  });

  it("مشاهده و پاسخ دو مجوز جدا دارند", () => {
    expect(admList).toContain('requirePlatformPermission("tickets.view")');
    expect(admItem).toContain('requirePlatformPermission("tickets.view")');
    expect(admItem).toContain('requirePlatformPermission("tickets.reply")');
  });

  it("🔴 ادمینِ فقط‌خواننده نشانگر خوانده‌نشده را پاک نمی‌کند", () => {
    // وگرنه تیکت از رادار تیم پاسخ‌گو خارج می‌شود و بی‌جواب می‌ماند.
    expect(admItem).toContain("if (canReply && ticket.unread_for_staff)");
  });

  it("is_staff هرگز از کلاینت فرستاده نمی‌شود", () => {
    for (const src of [custList, custItem, admItem]) {
      expect(src).not.toMatch(/is_staff:\s*(true|false|\w+\.\w+)/);
    }
  });

  it("پاسخ ادمین در گزارش ممیزی ثبت می‌شود", () => {
    expect(admItem).toContain('p_action: "ticket.replied"');
    expect(admItem).toContain('p_action: "ticket.updated"');
  });

  it("متن پیام در لاگ ممیزی کپی نمی‌شود", () => {
    // لاگ ممیزی نباید نسخه‌ی دوم داده‌ی مشتری شود.
    expect(admItem).toContain("length: body.length");
    /*
      فقط *طول* پیام ثبت می‌شود، نه خودش.
      (نسخه‌ی اول این ادعا با regex نوشته شده بود و روی «body.length»
      هم گیر می‌کرد — یعنی تست خودش غلط مثبت می‌داد.)
    */
    expect(admItem).not.toMatch(/p_meta:\s*\{[^}]*\bbody\b(?!\.length)/);
  });

  it("همه‌ی روت‌های تیکت rate limit دارند", () => {
    for (const src of [custList, custItem, admList, admItem]) {
      expect(src).toContain("tooManyRequests");
    }
  });

  it("سقف تیکت باز برای هر سازمان اعمال می‌شود", () => {
    // جلوگیری از تیکت تکراری وقتی کاربر جواب نمی‌گیرد.
    expect(custList).toContain('.in("status", ["open", "pending"])');
    expect(custList).toContain("(openCount ?? 0) >= 10");
  });

  it("تیکت بدون پیام باقی نمی‌ماند", () => {
    // Supabase از REST تراکنش چندمرحله‌ای نمی‌دهد؛ پاک‌سازی دستی لازم است.
    expect(custList).toContain('.from("support_tickets").delete().eq("id", ticket.id)');
  });
});

describe("ناوبری", () => {
  const sidebar = read("components/shared/sidebar.tsx");

  it("لینک پشتیبانی در منوی اصلی هست", () => {
    expect(sidebar).toContain('{ href: "/support", label: "پشتیبانی"');
  });

  it("لینک صف تیکت در منوی ادمین هست", () => {
    expect(sidebar).toContain('{ href: "/admin/tickets"');
  });

  it("🔴 صفحه‌ی پشتیبانی مجوز سازمانی نمی‌خواهد", () => {
    /*
      permissionForHref هیچ الگویی برای /support ندارد و null برمی‌گرداند
      و can(null) برابر true است. صندوق‌دار هم باید بتواند بگوید
      «صفحه‌ی فروش باز نمی‌شود».
    */
    expect(sidebar).not.toMatch(/href\.startsWith\("\/support"\)/);
  });
});

describe("🔴 عملیات جانبی باید await شوند", () => {
  const custItem = read("app/api/support/tickets/[id]/route.ts");
  const admItem = read("app/api/admin/tickets/[id]/route.ts");

  /*
    باگ واقعی که فقط با اجرای سرور و بررسی دیتابیس پیدا شد:

    نسخه‌ی اول `void svc.from(...).update(...)` می‌نوشت، با این تصور
    که «علامت‌زدن خوانده‌شده نباید پاسخ را کند کند». ولی سازنده‌ی
    کوئری Supabase یک thenable *تنبل* است — تا await نشود هیچ
    درخواستی به شبکه نمی‌رود. `void` فقط مقدار را دور می‌اندازد.

    اندازه‌گیری روی سرور واقعی: پس از باز کردن گفتگو،
    `customer_read_at` دست‌نخورده ماند و نشان «پاسخ جدید» برای همیشه
    روی تیکت می‌ماند. نه tsc، نه next build، نه هیچ تست واحدی این را
    نگرفت — فقط خواندن دیتابیس بعد از یک درخواست واقعی.
  */
  it.each([
    ["مشتری", readCode("app/api/support/tickets/[id]/route.ts")],
    ["ادمین", readCode("app/api/admin/tickets/[id]/route.ts")],
  ])("در روت %s هیچ کوئری Supabase با void رها نشده", (_label, src) => {
    expect(src).not.toMatch(/void\s+(auth\.)?svc\s*\n?\s*\./);
  });

  it("علامت خوانده‌شده در هر دو سمت await می‌شود", () => {
    expect(custItem).toMatch(/await svc\s*\n\s*\.from\("support_tickets"\)\s*\n\s*\.update\(\{ customer_read_at/);
    expect(admItem).toMatch(/await auth\.svc\s*\n\s*\.from\("support_tickets"\)\s*\n\s*\.update\(\{ staff_read_at/);
  });
});

describe("🔴 توکن رنگ متن روی پس‌زمینه‌ی ملایم", () => {
  const toast = read("src/shared/ui/Toast.tsx");

  it("توست از توکن onSoft استفاده می‌کند نه توکن پرکننده", () => {
    /*
      `text-success` رنگِ پُرکردن است و روی `bg-success-soft` نسبت
      کنتراست ۲٫۴۶:۱ می‌داد — کمتر از نصف آستانه‌ی ۴٫۵:۱ (اندازه‌گیری
      axe روی سرور واقعی). توکن `--success-on-soft` دقیقاً برای همین
      حالت وجود داشت ولی استفاده نشده بود.
    */
    expect(toast).toContain("bg-success-soft text-success-onSoft");
    expect(toast).toContain("bg-warning-soft text-warning-onSoft");
    expect(toast).not.toMatch(/bg-success-soft text-success[^-]/);
  });

  it("شفافیت روی متن اعمال نمی‌شود", () => {
    // توکن‌های متن روی آستانه کالیبره شده‌اند؛ هر opacity آن‌ها را
    // زیر آستانه می‌برد.
    const code = readCode("src/shared/ui/Toast.tsx");
    expect(code).not.toContain("opacity-85");
    expect(code).not.toContain("opacity-70");
  });

  it("پیام‌ها برای صفحه‌خوان اعلام می‌شوند", () => {
    // بدون aria-live، «تیکت ثبت شد» فقط دیده می‌شد نه شنیده.
    expect(toast).toContain('aria-live="polite"');
    expect(toast).toContain('role="region"');
    expect(toast).toContain('role={item.tone === "error" ? "alert" : "status"}');
  });
});

describe("🔴 دسترس‌پذیری سراسری که هنگام ساخت تیکت پیدا شد", () => {
  it("Field از label واقعی استفاده می‌کند نه span", () => {
    /*
      عنوان در `<span>` بود، نه `<label>`. یعنی هیچ‌کدام از ۷۷ فیلد
      پروژه — از فرم کالا و شخص تا پرداخت فاکتور — برچسب متصل نداشتند
      و صفحه‌خوان فقط «edit text» می‌گفت.
      (axe: `label` و `select-name`، هر دو critical.)
    */
    const inputs = read("src/shared/ui/Inputs.tsx");
    expect(inputs).toContain("<label\n        htmlFor={controlId}");
    expect(inputs).toContain("useId()");
    // خطا و راهنما باید به ورودی وصل شوند
    expect(inputs).toContain("aria-describedby");
  });

  it("دو نسخه‌ی سایدبار نام landmark متمایز دارند", () => {
    /*
      Sidebar دو بار رندر می‌شود (دسکتاپ و موبایل). هر دو `<nav>`
      هم‌نام داشتند → axe: landmark-unique روی *همه‌ی* صفحه‌ها.
    */
    const sidebar = read("components/shared/sidebar.tsx");
    expect(sidebar).toContain('variant?: "desktop" | "mobile"');
    expect(sidebar).toContain("aria-label={navLabel}");
    expect(sidebar).toContain("aria-label={`فهرست بخش‌ها — ${navLabel}`}");

    const shell = read("components/shared/app-shell.tsx");
    expect(shell).toContain('variant="mobile"');
  });

  it("نوار پایین موبایل هم نام دارد", () => {
    expect(read("components/shared/bottom-nav.tsx")).toContain('aria-label="ناوبری سریع پایین صفحه"');
  });
});
