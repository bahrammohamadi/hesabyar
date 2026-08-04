import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseUserAgent } from "../lib/security/user-agent";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("کندسازی ورود — منطق دیتابیس", () => {
  const mig = read("supabase/migrations/0032_login_throttle_sessions.sql");

  it("۵ تلاش اول بدون تأخیر است", () => {
    /*
      کاربری که رمزش را اشتباه تایپ می‌کند یا بین دو رمز شک دارد نباید
      مجازات شود. (اندازه‌گیری واقعی: ۱→۵ صفر ثانیه، ۶→۲s، ۷→۴s، ۸→۸s)
    */
    expect(mig).toContain("if v_count <= 5 then");
  });

  it("تأخیر نمایی با سقف ۱۵ دقیقه", () => {
    expect(mig).toContain("least(power(2, v_count - 5)::int, 900)");
  });

  it("🔴 قفل ثابت استفاده نمی‌شود", () => {
    /*
      OWASP قفل ثابت را توصیه نمی‌کند: مهاجم با ۵ رمز غلط می‌تواند
      عمداً حساب رقیب را قفل کند — انکار سرویس رایگان.
    */
    expect(mig).toContain("تأخیر نمایی");
    expect(mig).not.toMatch(/locked_forever|permanent_lock/);
  });

  it("کلید بر اساس شناسه ورود است نه user_id", () => {
    // اگر فقط برای کاربران موجود رکورد می‌ساختیم، تفاوت زمان پاسخ
    // خودش می‌گفت کدام ایمیل ثبت‌نام شده است.
    expect(mig).toContain("login_id      text primary key");
  });

  it("جدول برای کاربر عادی خواندنی نیست", () => {
    // خواندنی‌بودنش یعنی لو رفتن اینکه کدام حساب‌ها هدف حمله‌اند.
    expect(mig).toContain("revoke all on public.login_attempts from anon, authenticated");
  });

  it("توابع فقط به service_role داده شده‌اند", () => {
    // دسترسی کلاینت یعنی امکان پاک‌کردن شمارنده توسط خود مهاجم.
    expect(mig).toContain("grant execute on function public.record_login_failure(text) to service_role");
    expect(mig).not.toMatch(/grant execute on function public\.record_login_failure\(text\) to authenticated/);
  });

  it("شمارنده پس از ورود موفق و تغییر رمز پاک می‌شود", () => {
    expect(mig).toContain("clear_login_failures");
    // 🔴 هر دو مسیر تغییر رمز باید شمارنده را پاک کنند
    expect(read("app/api/account/password/route.ts")).toContain("clear_login_failures");
    expect(read("app/api/admin/users/password/route.ts")).toContain("clear_login_failures");
  });
});

describe("روت ورود", () => {
  const route = read("app/api/auth/login/route.ts");

  it("🔴 پاسخ وجود حساب را لو نمی‌دهد", () => {
    /*
      کد ۴۲۳ یا پیام متفاوت برای «قفل است» به مهاجم می‌گوید این حساب
      واقعی است. (تأیید شد: حساب موجود و ناموجود هر دو ۴۰۱ با پیام
      یکسان می‌دهند.)
    */
    const messages = route.match(/error: "[^"]+"/g) ?? [];
    const authErrors = messages.filter((m) => m.includes("اشتباه"));
    expect(authErrors.length).toBeGreaterThan(1);
    for (const m of authErrors) {
      expect(m).toBe('error: "نام کاربری یا رمز عبور اشتباه است."');
    }
  });

  it("دو لایه محافظت دارد: IP و حساب", () => {
    // per-IP جلوی credential stuffing را می‌گیرد که هر بار حساب
    // متفاوتی را امتحان می‌کند و به آستانه‌ی per-account نمی‌رسد.
    expect(route).toContain("login-ip:");
    expect(route).toContain("login_wait_seconds");
  });

  it("ورود موفق شمارنده را صفر می‌کند", () => {
    expect(route).toContain('svc.rpc("clear_login_failures"');
  });

  it("🔴 مسیر ورود عمومی است", () => {
    /*
      بازتولید شد: بدون این، حتی رمز درست هم «Unauthorized» می‌گرفت
      چون middleware جلوتر از خود روت جواب می‌داد — تناقض منطقی، روت
      ورود نمی‌تواند نیاز به ورود داشته باشد.
    */
    expect(read("lib/supabase/middleware.ts")).toContain('path === "/api/auth/login"');
  });

  it("صفحه‌ی ورود دیگر مستقیم به Supabase وصل نمی‌شود", () => {
    const page = read("app/login/page.tsx");
    expect(page).toContain('fetch("/api/auth/login"');
    expect(page).not.toContain("supabase.auth.signInWithPassword");
  });

  it("در زمان انتظار دکمه غیرفعال است", () => {
    // بدون این کاربر مدام کلیک می‌کند و خودش را بیشتر قفل می‌کند.
    const page = read("app/login/page.tsx");
    expect(page).toContain("disabled={retryAfter > 0}");
    expect(page).toContain("setRetryAfter");
  });
});

describe("مدیریت نشست", () => {
  const mig = read("supabase/migrations/0032_login_throttle_sessions.sql");
  const route = read("app/api/account/sessions/route.ts");

  it("🔴 بستن نشست بررسی مالکیت دارد", () => {
    /*
      بدون p_user_id در where، هر کاربری می‌توانست با حدس‌زدن یک UUID
      نشست کاربر دیگری را ببندد — IDOR کلاسیک.
      (تأیید شد: تلاش واقعی ۴۰۴ گرفت و نشست دست‌نخورده ماند.)
    */
    expect(mig).toContain("and user_id = p_user_id");
  });

  it("تعداد حذف‌شده برگردانده و بررسی می‌شود", () => {
    // 🔴 قبلاً در حالت «هیچی حذف نشد» هم ۲۰۰ برمی‌گشت و کاربر فکر
    // می‌کرد نشست بسته شده.
    expect(mig).toContain("get diagnostics v_deleted = row_count");
    expect(route).toContain("Number(deleted ?? 0) === 0");
  });

  it("نشست جاری از این مسیر بسته نمی‌شود", () => {
    // وگرنه کاربر از همان صفحه بیرون می‌افتد و فکر می‌کند خراب شده.
    expect(route).toContain("sessionId === currentSessionId");
  });

  it("«خروج از همه» نشست فعلی را نگه می‌دارد", () => {
    expect(route).toContain("id !== currentSessionId");
  });

  it("نمای نشست‌ها definer است", () => {
    /*
      auth.sessions به هیچ نقشی SELECT نداده — حتی service_role.
      همان درسی که در مهاجرت ۰۰۲۸ با v_admin_users گرفته شد.
    */
    expect(mig).toContain("create or replace view public.v_user_sessions");
    expect(mig).not.toMatch(/v_user_sessions[\s\S]{0,200}security_invoker\s*=\s*true/);
    expect(mig).toContain("revoke all on public.v_user_sessions from anon, authenticated");
  });
});

describe("تشخیص دستگاه", () => {
  it("مرورگرهای رایج شناسایی می‌شوند", () => {
    expect(parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1 Safari/604.1").os).toBe("آی‌او‌اس");
    expect(parseUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36").browser).toBe("کروم");
    expect(parseUserAgent("Mozilla/5.0 (Macintosh) Firefox/121.0").browser).toBe("فایرفاکس");
  });

  it("موبایل از تبلت تشخیص داده می‌شود", () => {
    // اندروید بدون «mobile» یعنی تبلت.
    expect(parseUserAgent("Mozilla/5.0 (Linux; Android 13; Pixel) Mobile Chrome/120").kind).toBe("mobile");
    expect(parseUserAgent("Mozilla/5.0 (Linux; Android 13; SM-T500) Chrome/120").kind).toBe("tablet");
    expect(parseUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0) Safari/604.1").kind).toBe("tablet");
  });

  it("🔴 HeadlessChrome شناسایی می‌شود", () => {
    /*
      این رشته «chrome/» ندارد. در تست واقعی ۸۰ نشست «مرورگر ناشناس»
      نمایش داده شدند تا این حالت اضافه شد.
    */
    expect(parseUserAgent("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/151.0").browser).toBe("کروم (خودکار)");
  });

  it("ابزارهای غیرمرورگری برچسب درست می‌گیرند", () => {
    // نمایش «مرورگر ناشناس» برای یک نشست سرور گمراه‌کننده است.
    expect(parseUserAgent("curl/8.14.1").label).toContain("curl");
    expect(parseUserAgent("Vercel Edge Functions").label).toContain("سرور");
  });

  it("ورودی خالی باعث خطا نمی‌شود", () => {
    expect(parseUserAgent(null).kind).toBe("unknown");
    expect(parseUserAgent("").label).toBe("دستگاه ناشناس");
  });

  it("ترتیب تشخیص درست است", () => {
    // بیشتر مرورگرها «Safari» و خیلی‌ها «Chrome» را هم در رشته دارند.
    expect(parseUserAgent("Mozilla/5.0 Chrome/120 Safari/537 Edg/120").browser).toBe("اِج");
    expect(parseUserAgent("Mozilla/5.0 Chrome/120 Safari/537 OPR/106").browser).toBe("اپرا");
  });
});
