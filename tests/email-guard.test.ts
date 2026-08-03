import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { looksDisposable, isValidEmailShape, emailError } from "../lib/email-guard";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("تشخیص ایمیل یک‌بارمصرف", () => {
  it("دامنه‌های رایج را می‌گیرد", () => {
    for (const d of [
      "mailinator.com", "tempmail.com", "temp-mail.org", "10minutemail.com",
      "guerrillamail.com", "yopmail.com", "1secmail.com", "mail.tm",
    ]) {
      expect(looksDisposable(`someone@${d}`), d).toBe(true);
    }
  });

  it("زیردامنه را هم می‌گیرد", () => {
    // «foo.mailinator.com» در فهرست نیست ولی باید مسدود شود.
    expect(looksDisposable("a@sub.mailinator.com")).toBe(true);
    expect(looksDisposable("a@x.y.yopmail.com")).toBe(true);
  });

  it("الگوهای عمومی دامنه‌های تازه را می‌گیرد", () => {
    /*
      فهرست همیشه عقب است — tempmail.com در فهرست مرجع ۸۲۰۰تایی
      نبود ولی روی سرویس زنده پذیرفته می‌شد.
    */
    expect(looksDisposable("a@temp-something.com")).toBe(true);
    expect(looksDisposable("a@my-trashmail.net")).toBe(true);
    expect(looksDisposable("a@20minutemail.io")).toBe(true);
    expect(looksDisposable("a@burner-mail.co")).toBe(true);
  });

  it("🔴 دامنه‌های معتبر را مسدود نمی‌کند", () => {
    /*
      خطرناک‌ترین حالت مثبت کاذب است: کاربر واقعی نتواند ثبت‌نام کند.
      موارد زیر کلمه‌ی مشکوک دارند ولی کاملاً معتبرند.
    */
    for (const d of [
      "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "proton.me",
      "icloud.com", "chmail.ir", "mail.ir", "yandex.com", "zoho.com",
      "live.com", "aol.com", "tarazoo.ir", "hesabyar.app", "shop.co.ir",
      "contemporary.com",       // شامل «temp»
      "templeuniversity.edu",   // شامل «temp»
      "attempt.io",             // شامل «temp»
      "tempo-design.com",       // شامل «tempo»
    ]) {
      expect(looksDisposable(`user@${d}`), d).toBe(false);
    }
  });

  it("ورودی خالی یا خراب را امن مدیریت می‌کند", () => {
    expect(looksDisposable(null)).toBe(false);
    expect(looksDisposable("")).toBe(false);
    expect(looksDisposable("بدون‌اتساین")).toBe(false);
    expect(looksDisposable("@")).toBe(false);
  });
});

describe("شکل ایمیل", () => {
  it("ایمیل درست را می‌پذیرد", () => {
    expect(isValidEmailShape("ali@gmail.com")).toBe(true);
    expect(isValidEmailShape("a.b+c@sub.domain.co.ir")).toBe(true);
  });

  it("ایمیل ناقص را رد می‌کند", () => {
    for (const bad of ["ali", "ali@", "@gmail.com", "ali@gmail", "a b@c.com", ""]) {
      expect(isValidEmailShape(bad), bad).toBe(false);
    }
  });
});

describe("پیام خطای فیلد", () => {
  it("شکل غلط را از دامنه‌ی موقت تفکیک می‌کند", () => {
    // کاربر باید بداند دقیقاً چه چیزی را عوض کند.
    expect(emailError("ali@gmail")).toContain("قالب");
    expect(emailError("ali@mailinator.com")).toContain("ایمیل موقت");
  });

  it("ایمیل درست خطا نمی‌دهد", () => {
    expect(emailError("ali@gmail.com")).toBeNull();
  });

  it("فیلد خالی خطا نمی‌گیرد", () => {
    // پیش از تایپ کردن نباید قرمز شود.
    expect(emailError("")).toBeNull();
    expect(emailError("   ")).toBeNull();
  });
});

describe("محافظ سمت دیتابیس", () => {
  const sql = read("supabase/migrations/0029_disposable_email_guard.sql");

  it("تریگر روی auth.users است نه فقط فرم", () => {
    /*
      🔴 حیاتی: فرم قابل دور زدن است. تست واقعی نشان داد درخواست
      مستقیم به /auth/v1/signup با mailinator.com و tempmail.com
      پذیرفته می‌شد و کاربر واقعی می‌ساخت.
      تریگر تنها نقطه‌ای است که همه‌ی مسیرها از آن عبور می‌کنند.
    */
    expect(sql).toContain("create trigger trg_guard_disposable_signup");
    expect(sql).toContain("before insert on auth.users");
  });

  it("سه لایه دارد: فهرست، زیردامنه، الگو", () => {
    expect(sql).toContain("where d.domain = v_domain");
    expect(sql).toContain("v_domain like '%.' || d.domain");
    expect(sql).toContain("v_domain ~ '(^|[.-])(temp|tmp|trash");
  });

  it("فقط درج جدید را می‌گیرد، کاربران موجود را نه", () => {
    // اگر کسی قبلاً با چنین ایمیلی ثبت‌نام کرده، نباید ناگهان قفل شود.
    expect(sql).toContain("before insert on auth.users");
    expect(sql).not.toContain("before insert or update on auth.users");
  });

  it("فهرست فقط برای سوپرادمین قابل دیدن است", () => {
    expect(sql).toContain("using (public.is_platform_admin())");
  });
});

describe("یکپارچگی با فرم ثبت‌نام", () => {
  const reg = read("app/register/page.tsx");

  it("پیش از ارسال بررسی می‌کند", () => {
    expect(reg).toContain("const emailProblem = emailError(email)");
  });

  it("بازخورد زنده روی فیلد دارد", () => {
    expect(reg).toContain("liveEmailError");
    expect(reg).toContain('role="alert"');
    expect(reg).toContain("aria-invalid");
  });

  it("پیام تریگر را قابل فهم نمایش می‌دهد", () => {
    expect(reg).toContain('raw.includes("ایمیل موقت")');
  });
});
