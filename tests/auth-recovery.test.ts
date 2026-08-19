import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  generateResetCode,
  hasRealEmail,
  hashResetCode,
  isWellFormedCode,
  maskLoginId,
  normalizeCodeInput,
  recoveryHint,
  RESET_CODE_LENGTH,
  RESET_FAILURE_MESSAGES,
} from "@/lib/security/recovery";

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

describe("تشخیص ایمیل واقعی", () => {
  /*
    🔴 اندازه‌گیری روی دیتابیس زنده: ۴ از ۶ کاربر ایمیل ساختگی
    @hesabyar.app دارند. اگر لینک بازیابی به آنجا بفرستیم، کاربر تا
    ابد منتظر ایمیلی می‌ماند که هرگز نمی‌رسد.
  */
  it("ایمیل ساختگی شماره‌محور واقعی حساب نمی‌شود", () => {
    expect(hasRealEmail("09121234567@hesabyar.app")).toBe(false);
    expect(hasRealEmail("test@hesabyar.app")).toBe(false);
    expect(hasRealEmail("ZAMANI@HESABYAR.APP")).toBe(false);
  });

  it("ایمیل واقعی تشخیص داده می‌شود", () => {
    expect(hasRealEmail("ali@gmail.com")).toBe(true);
    expect(hasRealEmail("navidyazdani1987@gmail.com")).toBe(true);
  });

  it("ورودی خراب واقعی حساب نمی‌شود", () => {
    expect(hasRealEmail("")).toBe(false);
    expect(hasRealEmail(null)).toBe(false);
    expect(hasRealEmail("bahram")).toBe(false);
    expect(hasRealEmail("a@b")).toBe(false);
    expect(hasRealEmail("no-at-sign.com")).toBe(false);
  });
});

describe("تولید کد بازیابی", () => {
  it("طولش دقیقاً هشت رقم است", () => {
    for (let i = 0; i < 40; i++) {
      const code = generateResetCode();
      expect(code).toHaveLength(RESET_CODE_LENGTH);
      expect(/^\d{8}$/.test(code)).toBe(true);
    }
  });

  /*
    🔴 اگر کد قابل پیش‌بینی باشد، کل زنجیره بی‌معنی است.
    این تست تصادفی‌بودن را اثبات نمی‌کند ولی مولد ثابت یا شمارنده‌ای
    را می‌گیرد.
  */
  it("کدها تکراری نیستند", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateResetCode());
    expect(seen.size).toBeGreaterThan(190);
  });

  it("همه‌ی ارقام صفر نیست", () => {
    const codes = Array.from({ length: 50 }, () => generateResetCode());
    expect(codes.every((c) => c === "00000000")).toBe(false);
  });
});

describe("هش کد", () => {
  it("برای کد یکسان همان هش را می‌دهد", () => {
    expect(hashResetCode("12345678", "p")).toBe(hashResetCode("12345678", "p"));
  });

  it("کد متفاوت هش متفاوت می‌دهد", () => {
    expect(hashResetCode("12345678", "p")).not.toBe(hashResetCode("12345679", "p"));
  });

  /*
    نمک متفاوت باید هش متفاوت بدهد، وگرنه لو رفتن هش یک نصب،
    همه‌ی نصب‌های دیگر را هم به خطر می‌اندازد.
  */
  it("نمک متفاوت هش متفاوت می‌دهد", () => {
    expect(hashResetCode("12345678", "a")).not.toBe(hashResetCode("12345678", "b"));
  });

  it("کد خام در هش دیده نمی‌شود", () => {
    expect(hashResetCode("12345678", "p")).not.toContain("12345678");
  });

  it("فاصله‌ی اضافی نتیجه را عوض نمی‌کند", () => {
    expect(hashResetCode(" 12345678 ", "p")).toBe(hashResetCode("12345678", "p"));
  });
});

describe("نرمال‌سازی ورودی کد", () => {
  /*
    🔴 کاربری که با کیبورد فارسی «۱۲۳۴۵۶۷۸» تایپ می‌کند کد **درست**
    را وارد کرده. بدون تبدیل رقم، «کد اشتباه» می‌گیرد و پس از پنج
    بار سهمیه‌اش تمام می‌شود بدون آنکه اشتباهی کرده باشد.
  */
  it("ارقام فارسی به لاتین تبدیل می‌شوند", () => {
    expect(normalizeCodeInput("۱۲۳۴۵۶۷۸")).toBe("12345678");
  });

  it("ارقام عربی هم تبدیل می‌شوند", () => {
    expect(normalizeCodeInput("١٢٣٤٥٦٧٨")).toBe("12345678");
  });

  it("فاصله و خط تیره حذف می‌شوند", () => {
    expect(normalizeCodeInput("1234 5678")).toBe("12345678");
    expect(normalizeCodeInput("1234-5678")).toBe("12345678");
  });

  it("کد فارسی معتبر شناخته می‌شود", () => {
    expect(isWellFormedCode("۱۲۳۴۵۶۷۸")).toBe(true);
    expect(isWellFormedCode("1234 5678")).toBe(true);
  });

  it("طول اشتباه یا حروف رد می‌شود", () => {
    expect(isWellFormedCode("1234567")).toBe(false);
    expect(isWellFormedCode("123456789")).toBe(false);
    expect(isWellFormedCode("abcdefgh")).toBe(false);
    expect(isWellFormedCode("")).toBe(false);
  });
});

describe("پوشاندن شناسه", () => {
  it("شماره‌ی موبایل وسطش پوشانده می‌شود", () => {
    const masked = maskLoginId("09121234567@hesabyar.app");
    expect(masked).toBe("0912***4567");
    expect(masked).not.toContain("hesabyar.app");
  });

  it("ایمیل واقعی دامنه‌اش می‌ماند ولی نامش پوشیده می‌شود", () => {
    const masked = maskLoginId("navidyazdani1987@gmail.com");
    expect(masked.startsWith("n")).toBe(true);
    expect(masked.endsWith("@gmail.com")).toBe(true);
    expect(masked).not.toContain("avidyazdani1987");
  });

  it("ورودی خالی خط تیره می‌شود نه خطا", () => {
    expect(maskLoginId("")).toBe("—");
    expect(maskLoginId(null)).toBe("—");
    expect(maskLoginId(undefined)).toBe("—");
  });

  it("شناسه‌ی کوتاه هم پوشانده می‌شود", () => {
    expect(maskLoginId("ab@x.com")).not.toBe("ab@x.com");
  });
});

describe("راهنمای بازیابی", () => {
  /*
    🔴 پیام هرگز نباید بگوید حساب وجود دارد یا نه.
    «اگر این حساب وجود داشته باشد» — چه باشد چه نباشد.
  */
  it("برای ایمیل واقعی وجود حساب را تأیید نمی‌کند", () => {
    const hint = recoveryHint("ali@gmail.com");
    expect(hint).toMatch(/اگر این حساب وجود داشته باشد/);
  });

  it("برای شناسه‌ی شماره‌محور مسیر مدیر را می‌گوید", () => {
    const hint = recoveryHint("09121234567@hesabyar.app");
    expect(hint).toMatch(/مدیر مجموعه/);
  });

  it("هر سه دلیل شکست پیام فارسی دارند", () => {
    for (const key of ["invalid", "expired", "too_many"]) {
      expect(RESET_FAILURE_MESSAGES[key]).toBeTruthy();
      expect(RESET_FAILURE_MESSAGES[key].length).toBeGreaterThan(5);
    }
  });
});

describe("همسانی با مهاجرت ۰۰۵۰", () => {
  const sql = readCode("supabase/migrations/0050_auth_hardening.sql");

  /*
    🔴 اگر کد خام ذخیره شود، نشت پشتیبان یعنی تصاحب فوری هر حساب.
  */
  it("کد بازیابی هش‌شده ذخیره می‌شود", () => {
    expect(sql).toMatch(/code_hash\s+text not null/);
    expect(sql).not.toMatch(/code\s+text not null,/);
  });

  it("جدول کد بازیابی برای کاربر عادی خوانا نیست", () => {
    expect(sql).toMatch(/alter table public\.password_reset_codes enable row level security/);
    expect(sql).toMatch(/revoke all on public\.password_reset_codes from anon, authenticated/);
  });

  /*
    گارد مالکیت داخل تابع است نه در کد برنامه: تابع definer است و
    اگر بررسی را به لایه‌ی برنامه بسپاریم، هر فراموشی یعنی صدور کد
    برای کاربر سازمان دیگر.
  */
  it("صدور کد فقط برای مالک یا مدیر همان سازمان است", () => {
    expect(sql).toMatch(/role in \('owner','manager'\)/);
    expect(sql).toMatch(/این کاربر عضو مجموعه‌ی شما نیست/);
  });

  /*
    بدون باطل‌کردن کد قبلی، مدیری که دو بار کد می‌سازد دو کد معتبر
    همزمان دارد و کد اول — که شاید در پیام‌رسان دیده شده — هنوز
    کار می‌کند.
  */
  it("صدور کد تازه، کدهای قبلی همان کاربر را باطل می‌کند", () => {
    expect(sql).toMatch(
      /update public\.password_reset_codes[\s\S]{0,120}set used_at = now\(\)[\s\S]{0,120}where user_id = p_user_id and used_at is null/
    );
  });

  it("سقف تلاش روی کد اعمال می‌شود", () => {
    expect(sql).toMatch(/attempt_count >= 5/);
    expect(sql).toMatch(/set attempt_count = attempt_count \+ 1/);
  });

  it("کد پس از مصرف باطل می‌شود", () => {
    expect(sql).toMatch(/update public\.password_reset_codes set used_at = now\(\) where id = v_row\.id/);
  });

  /*
    🔴 پاسخ «کاربر ناموجود» و «کد غلط» باید یکسان باشد، وگرنه مهاجم
    فهرست حساب‌های موجود را استخراج می‌کند.
  */
  it("کاربر ناموجود همان پاسخ کد غلط را می‌گیرد", () => {
    expect(sql).toMatch(
      /if v_user is null then\s+return jsonb_build_object\('ok', false, 'reason', 'invalid'\)/
    );
  });

  it("سابقه‌ی ورود جدا از شمارنده است", () => {
    expect(sql).toMatch(/create table if not exists public\.login_events/);
    expect(sql).toMatch(/check \(event in \('success','failure','throttled','reset','mfa_failure'\)\)/);
  });

  /*
    کاربر فقط سابقه‌ی خودش را می‌بیند، و **نمی‌تواند بنویسد** —
    وگرنه سابقه را با رویداد جعلی پر می‌کند.
  */
  it("سابقه فقط برای خود کاربر خوانا و غیرقابل نوشتن است", () => {
    expect(sql).toMatch(/create policy login_events_self_read on public\.login_events\s+for select using \(user_id = auth\.uid\(\)\)/);
    expect(sql).not.toMatch(/login_events[\s\S]{0,200}for all using/);
  });

  it("سابقه پس از نود روز پاک می‌شود", () => {
    expect(sql).toMatch(/interval '90 days'/);
  });

  it("فایل بازگشت وجود دارد و هشدار می‌دهد", () => {
    const down = read("supabase/rollbacks/0050_auth_hardening.down.sql");
    expect(down).toMatch(/drop table if exists public\.login_events/);
    expect(down).toMatch(/drop table if exists public\.password_reset_codes/);
    expect(down).toMatch(/سابقه/);
  });
});

describe("🔴 مسیرهای بازیابی در middleware", () => {
  const mw = readCode("lib/supabase/middleware.ts");

  /*
    کاربری که رمزش را فراموش کرده **وارد نشده است**. اگر این مسیرها
    عمومی نباشند، middleware او را به /login می‌فرستد و صفحه‌ی
    بازیابی هرگز دیده نمی‌شود. همان تله‌ای که قبلاً با /shop و
    /api/auth/login خوردیم.
  */
  it("صفحات بازیابی عمومی‌اند", () => {
    expect(mw).toMatch(/path\.startsWith\("\/forgot-password"\)/);
    expect(mw).toMatch(/path\.startsWith\("\/reset-password"\)/);
    expect(mw).toMatch(/isRecovery \|\|/);
  });

  it("روت‌های API بازیابی عمومی‌اند", () => {
    expect(mw).toMatch(/path === "\/api\/auth\/forgot-password"/);
    expect(mw).toMatch(/path === "\/api\/auth\/reset-code"/);
  });

  /*
    🔴 مهم‌ترین ادعای این دسته — باگی که حین نوشتن گرفته شد.

    کسی که از لینک ایمیل بازیابی می‌آید، Supabase برایش نشست ساخته
    است. اگر /reset-password جزو isAuthPage بود، همان نشست باعث
    ریدایرکت به /dashboard می‌شد و کاربر **هرگز** نمی‌توانست رمزش
    را عوض کند — با اینکه دقیقاً برای همین آمده.

    پس isRecovery باید از isAuthPage جدا بماند.
  */
  it("صفحه‌ی تعیین رمز کاربرِ واردشده را به داشبورد پرت نمی‌کند", () => {
    const authPageLine = mw.match(/const isAuthPage =[^;]+;/)?.[0] ?? "";
    expect(authPageLine).not.toMatch(/reset-password/);
    expect(authPageLine).not.toMatch(/forgot-password/);
    // و ریدایرکت فقط بر اساس isAuthPage است، نه isRecovery
    expect(mw).toMatch(/if \(user && isAuthPage\)/);
  });
});

describe("روت‌های بازیابی", () => {
  const forgot = readCode("app/api/auth/forgot-password/route.ts");
  const resetCode = readCode("app/api/auth/reset-code/route.ts");
  const login = readCode("app/api/auth/login/route.ts");

  /*
    بدون محدودیت نرخ، این روت ابزار اسپم رایگان است: مهاجم صندوق
    هر کسی را پر می‌کند و سهمیه‌ی ۲ ایمیل در ساعتِ پروژه را
    می‌سوزاند تا کاربر واقعی نتواند رمزش را بازیابی کند.
  */
  it("درخواست بازیابی محدودیت نرخ دارد", () => {
    expect(forgot).toMatch(/hit\(`forgot:\$\{clientIp\(request\)\}`/);
  });

  it("مصرف کد محدودیت نرخ دارد", () => {
    expect(resetCode).toMatch(/hit\(`reset-code-use:/);
  });

  /*
    🔴 پاسخ هرگز نباید بگوید حساب وجود دارد یا نه. خطای ارسال ایمیل
    عمداً بلعیده می‌شود.
  */
  it("خطای ارسال ایمیل به کاربر منتقل نمی‌شود", () => {
    expect(forgot).toMatch(/resetPasswordForEmail[\s\S]{0,240}\} catch \{/);
  });

  /*
    سیاست رمز باید سمت سرور اعمال شود؛ این مسیر اصلاً نیاز به ورود
    ندارد پس هر بررسی سمت مرورگر با یک درخواست مستقیم دور می‌خورد.
  */
  it("سیاست رمز سمت سرور اعمال می‌شود", () => {
    expect(resetCode).toMatch(/firstPasswordError\(newPassword\)/);
  });

  it("کد پیش از تماس با دیتابیس از نظر شکلی سنجیده می‌شود", () => {
    expect(resetCode).toMatch(/isWellFormedCode\(code\)/);
  });

  /*
    کاربری که تازه رمزش را عوض کرده نباید با اولین اشتباه تایپی
    بلافاصله به سطح تأخیر قبلی برگردد.
  */
  it("پس از تغییر رمز شمارنده‌ی کندسازی پاک می‌شود", () => {
    expect(resetCode).toMatch(/clear_login_failures/);
  });

  it("کد خام فقط در پاسخ صدور برمی‌گردد و ذخیره نمی‌شود", () => {
    expect(resetCode).toMatch(/p_code_hash: hashResetCode\(code, pepper\(\)\)/);
  });

  /*
    ثبت سابقه نباید مسیر ورود را بشکند: اگر این تماس خطا بدهد،
    کاربر قانونی نباید بیرون بماند.
  */
  it("ورود سابقه ثبت می‌کند ولی شکستش مانع ورود نمی‌شود", () => {
    expect(login).toMatch(/record_login_event/);
    expect(login).toMatch(/const logEvent = async[\s\S]{0,400}\} catch \{/);
  });

  it("هر سه حالت ورود ثبت می‌شوند", () => {
    expect(login).toMatch(/logEvent\("success", data\.user\.id\)/);
    expect(login).toMatch(/logEvent\("failure"\)/);
    expect(login).toMatch(/logEvent\("throttled"\)/);
  });
});

describe("صفحه‌ی ورود و لینک بازیابی", () => {
  const page = readCode("app/login/page.tsx");

  /*
    🔴 تا این نسخه هیچ راهی برای بازیابی نبود و FAQ می‌گفت «با
    پشتیبانی تماس بگیرید».
  */
  it("لینک فراموشی رمز در صفحه‌ی ورود هست", () => {
    expect(page).toMatch(/href="\/forgot-password"/);
  });
});

describe("🔴 مرز سرور و کلاینت", () => {
  /*
    باگی که فقط `next build` گرفت — نه tsc، نه ۱۴۲۰ تست:

      UnhandledSchemeError: Reading from "node:crypto" is not handled

    صفحه‌ی /reset-password کامپوننت کلاینت است و RESET_CODE_LENGTH را
    از همان فایلی می‌خواند که node:crypto داشت، پس وب‌پک کل ماژول را
    داخل باندل مرورگر می‌کشید.

    ⚠️ انتقال require به داخل بدنه‌ی تابع **کافی نبود** — وب‌پک آن را
    هم به‌صورت ایستا تحلیل می‌کند. تنها راه جداکردن فایل بود.
  */
  it("فایل مشترک هیچ وابستگی به node ندارد", () => {
    const shared = readCode("lib/security/recovery.shared.ts");
    expect(shared).not.toMatch(/node:crypto/);
    expect(shared).not.toMatch(/require\(/);
    expect(shared).not.toMatch(/from "node:/);
  });

  it("فایل سروری crypto دارد و فقط از سرور خوانده می‌شود", () => {
    expect(readCode("lib/security/recovery.ts")).toMatch(/from "node:crypto"/);

    // هیچ کامپوننت کلاینتی نباید فایل سروری را import کند.
    for (const p of ["app/reset-password/page.tsx", "app/forgot-password/page.tsx"]) {
      const page = readCode(p);
      if (!page.includes("security/recovery")) continue;
      expect(page).toMatch(/security\/recovery\.shared/);
      expect(page).not.toMatch(/from "@\/lib\/security\/recovery"/);
    }
  });

  it("صفحه‌ی تعیین رمز واقعاً کامپوننت کلاینت است", () => {
    expect(read("app/reset-password/page.tsx").startsWith('"use client"')).toBe(true);
  });
});

describe("🔴 خانواده‌باگ راست‌به‌چپ", () => {
  /*
    فلش جهت‌دار در متن RTL بازچینش می‌شود. نوشته بود
    «تنظیمات ← کاربران» ولی روی صفحه «تنظیمات → کاربران» دیده
    می‌شد — یعنی ترتیب مسیر برعکس به‌نظر می‌رسید.

    ⚠️ در DOM متن درست بود؛ فقط رندر خراب می‌شد. با اسکرین‌شات
    پیدا شد نه با تست رشته‌ای، پس این تست روی *نبودن الگو* است.
  */
  it("در متن راهنما فلش جهت‌دار به کار نرفته", () => {
    for (const p of ["app/forgot-password/page.tsx", "app/reset-password/page.tsx"]) {
      const jsx = readCode(p);
      expect(jsx).not.toMatch(/[←→]/);
    }
  });

  /*
    رشته‌ی `${توکن۱} · ${توکن۲}` در RTL اعداد را به هم می‌چسباند.
    راه‌حل مستندشده: span جدا در flex با جداکننده‌ی aria-hidden.
  */
  it("فراداده‌ی کد صادرشده span جدا دارد", () => {
    const ua = readCode("components/shared/users-access.tsx");
    expect(ua).toMatch(/aria-hidden="true">·</);
    expect(ua).toMatch(/tabular-nums">اعتبار \{toFaDigits/);
  });
});
