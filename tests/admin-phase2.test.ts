import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const sql = read("supabase/migrations/0028_admin_phase2.sql");
const impRoute = read("app/api/admin/impersonate/route.ts");
const banner = read("components/shared/impersonation-banner.tsx");
const searchRoute = read("app/api/admin/users/search/route.ts");
const annRoute = read("app/api/admin/announcements/route.ts");

describe("ورود به‌جای کاربر — گاردهای امنیتی", () => {
  it("نقش NULL صریح بررسی می‌شود، نه فقط not in", () => {
    /*
      🔴 باگ واقعی که تست گرفت: برای غیرادمین platform_admin_role
      برابر NULL است و `NULL not in (...)` مقدار NULL می‌دهد نه TRUE،
      پس شرط if اجرا نمی‌شد و اجرا تا خود INSERT پیش می‌رفت.
      کاربر test از گارد رد شد و فقط تصادفاً به‌خاطر NOT NULL بودن
      ستون read_only شکست خورد.
    */
    expect(sql).toContain("if v_role is null or v_role not in ('super_admin', 'support')");
  });

  it("دلیل اجباری است — در دیتابیس و در API", () => {
    expect(sql).toContain("ثبت دلیل الزامی است");
    // «تست» توضیح نیست؛ حداقل طول در روت اعمال می‌شود
    expect(impRoute).toContain("reason.length < 5");
  });

  it("ورود به‌جای ادمین دیگر مسدود است", () => {
    // زنجیره‌ی مسئولیت نباید بشکند.
    expect(sql).toContain("ورود به‌جای یک ادمین دیگر مجاز نیست");
  });

  it("جلسه سقف زمانی دارد", () => {
    expect(sql).toContain("now() + interval '30 minutes'");
    // انقضا در خواندن هم بررسی می‌شود، نه فقط با کار زمان‌بندی‌شده
    expect(sql).toContain("and s.expires_at > now()");
  });

  it("نقش support فقط‌خواندنی می‌گیرد", () => {
    expect(sql).toContain("v_role = 'support'");
    expect(banner).toContain("فقط مشاهده");
  });

  it("رویداد شروع و پایان هر دو لاگ می‌شوند", () => {
    expect(sql).toContain("'impersonation.started'");
    expect(sql).toContain("'impersonation.ended'");
  });

  it("لاگ با هویت واقعی ادمین ثبت می‌شود نه کاربر جعل‌شده", () => {
    // v_actor همیشه ادمین است؛ p_target فقط هدف است.
    expect(sql).toMatch(/log_platform_action\(\s*\n?\s*'impersonation\.started',\s*v_actor/);
  });

  it("جلسه‌ی باز قبلی خودکار بسته می‌شود", () => {
    // جلسه‌های رهاشده نباید روی هم انباشته شوند.
    expect(sql).toContain("ended_reason = 'جلسه‌ی جدید جایگزین شد'");
  });

  it("سقف نرخ روی شروع جلسه اعمال شده", () => {
    expect(impRoute).toContain("imp-start:");
    expect(impRoute).toContain("blockSeconds: 900");
  });
});

describe("نوار هشدار جعل هویت", () => {
  it("همیشه دیده می‌شود و راه خروج دارد", () => {
    expect(banner).toContain('role="alert"');
    expect(banner).toContain("sticky top-0");
    expect(banner).toContain("خروج از این حالت");
  });

  it("بالاترین لایه است تا زیر چیزی گم نشود", () => {
    expect(banner).toContain('zIndex: "var(--z-toast)"');
  });

  it("شمارش معکوس زنده دارد", () => {
    expect(banner).toContain("setInterval");
    expect(banner).toContain("toFaDigits");
  });

  it("برای غیرادمین بی‌صدا هیچ نشان نمی‌دهد", () => {
    // ۴۰۳ نباید به کاربر عادی خطا نشان دهد.
    expect(banner).toContain("if (!res.ok) return null");
  });
});

describe("نمای کاربران پلتفرم", () => {
  it("security_invoker ندارد چون به auth.users نیاز دارد", () => {
    /*
      🔴 با security_invoker=true خطای «permission denied for table
      users» می‌گرفتیم (HTTP 500، کد 42501) — auth.users به هیچ نقشی
      جز postgres دسترسی نمی‌دهد، حتی service_role.
    */
    const viewBlock = sql.slice(sql.indexOf("create view public.v_admin_users"), sql.indexOf("comment on view public.v_admin_users"));
    expect(viewBlock).not.toContain("security_invoker");
  });

  it("دسترسی مستقیم از نقش‌های عمومی گرفته شده", () => {
    expect(sql).toContain("revoke all on public.v_admin_users from anon, authenticated");
    expect(sql).toContain("grant select on public.v_admin_users to service_role");
  });

  it("ارقام فارسی در جستجو به لاتین تبدیل می‌شوند", () => {
    // بدون این، جستجوی شماره تماس با «۰۹۱۲» هیچ‌وقت نتیجه نمی‌داد.
    expect(searchRoute).toContain("۰۱۲۳۴۵۶۷۸۹");
  });

  it("ویژه‌کاراکترهای الگوی LIKE خنثی می‌شوند", () => {
    expect(searchRoute).toContain("replace(/[%_,]/g");
  });
});

describe("اعلان پلتفرم", () => {
  it("RLS خودش فیلتر می‌کند: فعال، در بازه، و سازمان درست", () => {
    expect(sql).toContain("and starts_at <= now()");
    expect(sql).toContain("(ends_at is null or ends_at > now())");
    expect(sql).toContain("(org_id is null or org_id in (select public.user_org_ids()))");
  });

  it("فقط super_admin می‌تواند اعلان بسازد", () => {
    expect(sql).toContain("when 'announcements.manage' then v_role in ('super_admin')");
  });

  it("غیرفعال می‌شود، حذف نمی‌شود — ردپا می‌ماند", () => {
    expect(annRoute).toContain("announcement.disabled");
    expect(annRoute).not.toContain(".delete()");
  });

  it("org_id اگر بیاید باید uuid معتبر باشد (ضد IDOR)", () => {
    expect(annRoute).toContain("!isUuid(orgId)");
  });
});

describe("ماتریس مجوز فاز ۲", () => {
  it("سه مجوز تازه اضافه شده", () => {
    expect(sql).toContain("when 'impersonate'");
    expect(sql).toContain("when 'announcements.manage'");
    expect(sql).toContain("when 'tickets.reply'");
  });

  it("finance و readonly حق جعل هویت ندارند", () => {
    expect(sql).toContain("when 'impersonate'          then v_role in ('super_admin', 'support')");
  });
});
