import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  generateCode, hashCode, safeEqual, looksLikeEmail,
  CODE_TTL_MINUTES, MAX_ATTEMPTS,
} from "@/lib/security/verification";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
/** کد بدون توضیحات — چند ادعا قبلاً روی توضیح فارسی گیر می‌کردند. */
const readCode = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(\/\/|--).*$/gm, "");

const mig = read("supabase/migrations/0038_instant_signup_verification.sql");
const migCode = readCode("supabase/migrations/0038_instant_signup_verification.sql");

describe("تولید کد تأیید", () => {
  it("همیشه ۶ رقم است", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).toMatch(/^\d{6}$/);
    }
  });

  it("🔴 کد با صفر ابتدایی هم ۶ رقم می‌ماند", () => {
    /*
      بدون padStart، عدد ۴۲ به «42» تبدیل می‌شد و اعتبارسنجی
      /^\d{6}$/ رد می‌کرد — کاربر کدی می‌گرفت که سیستم خودش
      نمی‌پذیرفت. با ۲۰۰ تکرار احتمال دیدن این حالت بالاست.
    */
    const codes = Array.from({ length: 500 }, () => generateCode());
    expect(codes.every((c) => c.length === 6)).toBe(true);
  });

  it("کدها تکراری نیستند", () => {
    const set = new Set(Array.from({ length: 300 }, () => generateCode()));
    // با یک میلیون حالت، ۳۰۰ نمونه نباید بیش از چند برخورد داشته باشد.
    expect(set.size).toBeGreaterThan(290);
  });
});

describe("چکیده‌سازی کد", () => {
  it("خروجی SHA-256 با طول ۶۴ است", () => {
    expect(hashCode("123456", "user-1")).toHaveLength(64);
  });

  it("🔴 دو کاربر با کد یکسان، چکیده‌ی متفاوت دارند", () => {
    /*
      نمک با شناسه‌ی کاربر ساخته می‌شود. بدون آن، یک جدول رنگین‌کمانی
      یک‌میلیون‌تایی همه‌ی کدهای فعال را لو می‌داد.
    */
    expect(hashCode("123456", "user-1")).not.toBe(hashCode("123456", "user-2"));
  });

  it("همان ورودی همان خروجی می‌دهد", () => {
    expect(hashCode("999999", "u")).toBe(hashCode("999999", "u"));
  });
});

describe("مقایسه‌ی زمان‌ثابت", () => {
  it("برابرها را درست تشخیص می‌دهد", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
  });
  it("نابرابرها را رد می‌کند", () => {
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "a")).toBe(false);
  });
});

describe("اعتبارسنجی شکل ایمیل", () => {
  it.each(["a@b.co", "user.name@gmail.com", "x@y.ir"])("«%s» معتبر", (e) => {
    expect(looksLikeEmail(e)).toBe(true);
  });
  it.each(["a@b", "no-at.com", "@b.co", "a b@c.co", ""])("«%s» نامعتبر", (e) => {
    expect(looksLikeEmail(e)).toBe(false);
  });
});

describe("ثابت‌های امنیتی", () => {
  it("اعتبار کد کوتاه ولی قابل استفاده است", () => {
    // کمتر از ۵ دقیقه آزاردهنده، بیش از ۳۰ دقیقه پنجره‌ی حمله را باز می‌کند.
    expect(CODE_TTL_MINUTES).toBeGreaterThanOrEqual(5);
    expect(CODE_TTL_MINUTES).toBeLessThanOrEqual(30);
  });

  it("🔴 سقف تلاش، حدس‌زدن کد را بی‌فایده می‌کند", () => {
    /*
      کد ۶ رقمی یک میلیون حالت دارد. بدون سقف، با چند هزار درخواست
      در دقیقه در کمتر از یک روز شکسته می‌شود.
    */
    expect(MAX_ATTEMPTS).toBeGreaterThan(0);
    expect(MAX_ATTEMPTS).toBeLessThanOrEqual(10);
  });
});

describe("🔴 امنیت روت تأیید", () => {
  const route = readCode("app/api/account/verify-email/route.ts");

  it("کد خام هرگز در پاسخ برنمی‌گردد", () => {
    /*
      وسوسه‌ی «چون ایمیل نمی‌رود، کد را در پاسخ بده» وجود داشت.
      آن یعنی هرکسی با یک درخواست، کد حساب خودش را می‌گیرد و تأیید
      ایمیل کاملاً بی‌معنا می‌شود.
    */
    // فقط پاسخ‌های JSON بررسی می‌شوند، نه هر جای فایل:
    // `hashCode(code, user.id)` استفاده‌ی درست است و نباید تست را بشکند.
    for (const m of route.matchAll(/NextResponse\.json\(([\s\S]{0,400}?)\)\s*[;,]/g)) {
      expect(m[1], "کد خام در پاسخ").not.toMatch(/(^|[\s{,])code\s*[,}:]/);
    }
  });

  it("فقط چکیده ذخیره می‌شود", () => {
    expect(route).toContain("code_hash: hashCode(code, user.id)");
    expect(route).not.toMatch(/code_hash:\s*code\b/);
  });

  it("مقایسه زمان‌ثابت است", () => {
    expect(route).toContain("safeEqual(");
  });

  it("شمارنده‌ی تلاش پیش از پاسخ بالا می‌رود", () => {
    // اگر بعد از پاسخ بود، مهاجم می‌توانست اتصال را قطع کند و
    // شمارنده هرگز بالا نرود.
    const failIdx = route.indexOf("attempts: (record.attempts as number) + 1");
    const respIdx = route.indexOf("کد نادرست است");
    expect(failIdx).toBeGreaterThan(-1);
    expect(failIdx).toBeLessThan(respIdx);
  });

  it("انقضا و سقف تلاش هر دو بررسی می‌شوند", () => {
    expect(route).toContain("منقضی شده");
    expect(route).toContain(">= MAX_ATTEMPTS");
  });

  it("همه‌ی مسیرها سقف نرخ دارند", () => {
    expect(route.match(/tooManyRequests/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("هیچ کوئری Supabase با void رها نشده", () => {
    // درس تیکت پشتیبانی: سازنده‌ی کوئری تنبل است.
    expect(route).not.toMatch(/void\s+svc\s*\n?\s*\./);
  });
});

describe("🔴 مهاجرت ۰۰۳۸", () => {
  it("همه‌ی امضاهای bootstrap_org پاک می‌شوند", () => {
    /*
      اندازه‌گیری واقعی: دو نسخه در دیتابیس بود —
        bootstrap_org(text)  ← بازمانده‌ی نسخه‌ی اولیه
        bootstrap_org(text,text,text,text)
      چون همه‌ی پارامترها پیش‌فرض دارند، فراخوانی با یک آرگومان
      (همان چیزی که PostgREST می‌فرستد) مبهم می‌شد:
        ERROR 42725: function bootstrap_org(unknown) is not unique
      پس حلقه روی pg_proc، نه drop دستیِ چند امضای حدسی.
    */
    expect(migCode).toContain("from pg_proc");
    expect(migCode).toContain("where proname = 'bootstrap_org'");
    expect(migCode).toContain("execute format('drop function if exists %s', r.sig)");
  });

  it("سازمان‌های موجود تأییدشده فرض می‌شوند", () => {
    // بدون این، سه کسب‌وکار فعلی ناگهان نوار هشدار می‌دیدند.
    expect(migCode).toContain("set email_verified_at = coalesce(email_verified_at, created_at)");
  });

  it("کد تأیید از سمت کلاینت خواندنی نیست", () => {
    // policy برای authenticated وجود ندارد؛ فقط service_role.
    expect(migCode).toContain("alter table public.email_verifications enable row level security");
    expect(migCode).not.toMatch(/create policy \w+ on public\.email_verifications/);
  });

  it("سقف ساخت حساب برای هر IP تعریف شده", () => {
    expect(migCode).toContain("signup_ip_exceeded");
    expect(migCode).toContain("interval '24 hours'");
  });

  it("IP خالی کاربر را مسدود نمی‌کند", () => {
    // بستن دسترسی کاربر واقعی بدتر از عبور یک مورد مشکوک است.
    expect(migCode).toContain("when p_ip is null or btrim(p_ip) = '' then false");
  });

  it("کارمند (غیرمالک) نیازی به تأیید ندارد", () => {
    // ایمیلش را خودِ مدیر ساخته.
    expect(migCode).toContain("or not exists");
  });

  it("فایل بازگردانی دارد", () => {
    expect(readdirSync(join(root, "supabase/rollbacks")))
      .toContain("0038_instant_signup_verification.down.sql");
  });
});

describe("🔴 جریان ثبت‌نام", () => {
  const reg = readCode("app/register/page.tsx");

  it("کاربر پس از ثبت‌نام بلافاصله وارد می‌شود", () => {
    /*
      باگ اصلی: پیام «لینک تأیید به ایمیلت رفت» و پایان کار. کاربر نه
      نشستی داشت نه سازمانی. اندازه‌گیری روی سرور واقعی پس از یک
      ثبت‌نام: email_confirmed_at = null و organizations = صفر ردیف.
    */
    expect(reg).toContain("signInWithPassword");
    expect(reg).toContain('router.push("/onboarding")');
  });

  it("پیام بن‌بست «منتظر ایمیل بمان» حذف شده", () => {
    expect(reg).not.toContain("لینک تأیید به ایمیل شما ارسال شد");
  });

  it("گارد ایمیل یکبارمصرف سر جایش است", () => {
    expect(reg).toContain("emailError(email)");
  });
});

describe("نوار تأیید ایمیل", () => {
  const banner = readCode("components/shared/email-verify-banner.tsx");

  it("پنل را مسدود نمی‌کند", () => {
    // اگر دیوار می‌گذاشتیم، کل هدف تغییر جریان از بین می‌رفت.
    expect(banner).not.toContain("fixed inset-0");
  });

  it("برای کاربر غیرمالک رندر نمی‌شود", () => {
    expect(banner).toContain("if (!data?.needsVerification");
  });

  it("ورودی کد فقط رقم می‌پذیرد و برچسب دارد", () => {
    expect(banner).toContain('replace(/\\D/g, "")');
    expect(banner).toContain('htmlFor="verify-code"');
  });

  it("در app-shell رندر می‌شود", () => {
    expect(readCode("components/shared/app-shell.tsx")).toContain("<EmailVerifyBanner />");
  });
});

describe("🔴 دسترس‌پذیری صفحه‌ی معارفه", () => {
  const ob = read("app/onboarding/page.tsx");

  it("landmark اصلی دارد", () => {
    /*
      این صفحه بیرون از گروه (app) است و AppShell دور آن نیست.
      axe دو ایراد می‌داد: landmark-one-main و region.
    */
    expect(ob).toContain("<main");
    expect(ob).toContain("</main>");
  });

  it("تعداد باز و بسته برابر است", () => {
    // توضیحات حذف می‌شوند: کلمه‌ی <main> داخل کامنت، شمارش را خراب
    // می‌کرد و تست غلط مثبت می‌داد.
    const code = ob.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect((code.match(/<main/g) ?? []).length).toBe((code.match(/<\/main>/g) ?? []).length);
  });
});
