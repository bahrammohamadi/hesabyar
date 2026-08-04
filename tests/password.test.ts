import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  validatePassword,
  firstPasswordError,
  passwordStrength,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "../lib/security/password";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("اعتبارسنجی رمز عبور", () => {
  it("رمز کوتاه رد می‌شود", () => {
    expect(validatePassword("abc123")).toContain("too_short");
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).toContain("too_short");
  });

  it("رمز بلندتر از سقف bcrypt رد می‌شود", () => {
    // فراتر از ۷۲ نویسه، bcrypt بی‌صدا می‌برد — یعنی کاربر فکر می‌کند
    // رمز بلندی دارد ولی عملاً ندارد.
    expect(validatePassword("a1".repeat(MAX_PASSWORD_LENGTH))).toContain("too_long");
  });

  it("رمزهای پرتکرار رد می‌شوند", () => {
    for (const p of ["12345678", "password", "qwerty123", "admin123"]) {
      expect(validatePassword(p)).toContain("common");
    }
  });

  it("رمز فقط-عددی رد می‌شود", () => {
    /*
      شماره موبایل و کد ملی پرتکرارترین انتخاب کاربران ایرانی‌اند و هر
      دو از حداقل طول رد می‌شوند، ولی حدس‌زدنشان ساده است.
    */
    expect(validatePassword("09121234567")).toContain("only_digits");
    expect(validatePassword("1234567890")).toContain("only_digits");
  });

  it("رمز جدید نباید با فعلی یکسان باشد", () => {
    expect(validatePassword("GoodPass!26", "GoodPass!26")).toContain("same_as_current");
    expect(validatePassword("GoodPass!26", "OtherPass!26")).not.toContain("same_as_current");
  });

  it("رمز مناسب پذیرفته می‌شود", () => {
    expect(validatePassword("Tarazoo!2026")).toEqual([]);
    expect(firstPasswordError("Tarazoo!2026")).toBeNull();
  });

  it("پیام خطا فارسی است", () => {
    const msg = firstPasswordError("123");
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/[\u0600-\u06FF]/);
  });
});

describe("سنجش کیفیت رمز", () => {
  it("رمز خالی امتیاز صفر می‌گیرد", () => {
    expect(passwordStrength("").score).toBe(0);
  });

  it("رمز رد شده هرگز قوی نشان داده نمی‌شود", () => {
    /*
      وگرنه کاربر نوار سبز می‌دید ولی فرم قبولش نمی‌کرد — تناقضی که
      باعث می‌شود فکر کند برنامه خراب است.
    */
    expect(passwordStrength("1234567890123456").score).toBeLessThanOrEqual(1);
    expect(passwordStrength("password").score).toBeLessThanOrEqual(1);
  });

  it("رمز قوی امتیاز بالا می‌گیرد", () => {
    expect(passwordStrength("Tarazoo!2026$Long").score).toBeGreaterThanOrEqual(3);
  });

  it("برچسب فارسی دارد", () => {
    expect(passwordStrength("Tarazoo!2026").label).toMatch(/[\u0600-\u06FF]/);
  });
});

describe("امنیت مسیر تغییر رمز کاربر", () => {
  const route = read("app/api/account/password/route.ts");

  it("رمز فعلی الزامی است", () => {
    /*
      🔴 Supabase در updateUser({password}) رمز فعلی را نمی‌پرسد؛ فقط
      نشست معتبر می‌خواهد. یعنی هر کسی با چند لحظه دسترسی به لپ‌تاپِ
      بازِ کاربر می‌توانست رمز را عوض کند و صاحب حساب را بیرون بیندازد.
    */
    expect(route).toContain("current_password");
    expect(route).toContain("signInWithPassword");
  });

  it("تأیید رمز با کلاینت جدا انجام می‌شود", () => {
    // وگرنه signInWithPassword کوکی نشست فعلی را بازنویسی می‌کرد.
    expect(route).toContain("persistSession: false");
    expect(route).toContain("verifier.auth.signOut()");
  });

  it("محدودیت نرخ سخت‌گیرانه دارد", () => {
    // این روت یک اوراکل تأیید رمز است؛ بدون محدودیت قابل brute-force.
    expect(route).toMatch(/limit: 5, windowSeconds: 300/);
  });

  it("خودِ رمز هرگز لاگ نمی‌شود", () => {
    expect(route).not.toMatch(/newPassword.*log|log.*newPassword/);
    expect(route).toContain('action: "password_change"');
  });
});

describe("امنیت مسیر بازنشانی توسط ادمین", () => {
  const route = read("app/api/admin/users/password/route.ts");

  it("مجوز اختصاصی می‌خواهد", () => {
    expect(route).toContain('requirePlatformPermission("users.password")');
  });

  it("دلیل اجباری است", () => {
    expect(route).toContain("reason.length < 5");
  });

  it("ادمین نمی‌تواند رمز ادمین دیگری را عوض کند", () => {
    // وگرنه یک ادمین می‌توانست بقیه را از پلتفرم بیرون بیندازد.
    expect(route).toContain('from("platform_admins")');
    expect(route).toContain("رمز ادمین‌های پلتفرم از این مسیر قابل تغییر نیست");
  });

  it("ادمین رمز خودش را از این مسیر عوض نمی‌کند", () => {
    // مسیر عادی رمز فعلی می‌پرسد؛ این یعنی دور زدن آن بررسی.
    expect(route).toContain("targetUserId === actorId");
  });

  it("ممیزی پیش از خود تغییر ثبت می‌شود", () => {
    /*
      اگر بعد از تغییر لاگ می‌کردیم و درج شکست می‌خورد، یک تغییر رمز
      ثبت‌نشده باقی می‌ماند — دقیقاً همان چیزی که ممیزی باید بگیرد.
    */
    const logIdx = route.indexOf("log_platform_action");
    const updateIdx = route.indexOf("updateUserById");
    expect(logIdx).toBeGreaterThan(-1);
    expect(logIdx).toBeLessThan(updateIdx);
  });

  it("همان قواعد رمز کاربران عادی اعمال می‌شود", () => {
    expect(route).toContain("firstPasswordError");
  });
});

describe("🔴 مجوزهای گمشده‌ی ماتریس ادمین", () => {
  const mig = read("supabase/migrations/0031_password_reset_permission.sql");

  /*
    باگی که با فراخوانی واقعی endpoint کشف شد:
    سه مجوز که روت‌ها استفاده می‌کردند در ماتریس تعریف نشده بودند و به
    `else false` می‌افتادند. روی سایت زنده حتی super_admin هم 403
    می‌گرفت و جستجوی کاربران، جعل هویت و اعلان‌ها کاملاً از کار افتاده
    بودند — صفحه بدون خطا رندر می‌شد ولی همیشه خالی می‌ماند.
  */
  it("هر مجوزی که روت‌ها می‌خواهند در ماتریس هست", () => {
    const routeFiles = [
      "app/api/admin/users/search/route.ts",
      "app/api/admin/impersonate/route.ts",
      "app/api/admin/announcements/route.ts",
      "app/api/admin/audit/route.ts",
      "app/api/admin/organizations/route.ts",
      "app/api/admin/users/password/route.ts",
    ];
    const wanted = new Set<string>();
    for (const f of routeFiles) {
      for (const m of read(f).matchAll(/requirePlatformPermission\("([^"]+)"\)/g)) {
        wanted.add(m[1]);
      }
    }
    expect(wanted.size).toBeGreaterThan(3);
    for (const perm of wanted) {
      expect(mig, `مجوز «${perm}» در ماتریس تعریف نشده`).toContain(`when '${perm}'`);
    }
  });

  it("سه مجوز گمشده صریحاً اضافه شده‌اند", () => {
    expect(mig).toContain("when 'users.view'");
    expect(mig).toContain("when 'impersonate'");
    expect(mig).toContain("when 'announcements.manage'");
  });

  it("گارد NULL حفظ شده", () => {
    // NULL not in (...) نتیجه‌اش NULL است نه TRUE.
    expect(mig).toContain("if v_role is null then");
  });

  it("بازنشانی رمز فقط super_admin", () => {
    expect(mig).toMatch(/when 'users\.password'\s+then v_role = 'super_admin'/);
  });

  it("اعلان سراسری فقط super_admin", () => {
    expect(mig).toMatch(/when 'announcements\.manage' then v_role = 'super_admin'/);
  });

  it("جعل هویت برای پشتیبانی هم مجاز است", () => {
    // پشتیبانی باید مشکل را از چشم کاربر ببیند؛ عملیات پایان‌دار و لاگ‌شده است.
    expect(mig).toMatch(/when 'impersonate'\s+then v_role in \('super_admin', 'support'\)/);
  });

  it("فایل بازگردانی وجود دارد و هشدار می‌دهد", () => {
    const down = read("supabase/rollbacks/0031_password_reset_permission.down.sql");
    expect(down).toContain("403");
  });
});

describe("رابط کاربری", () => {
  it("صفحه‌ی حساب کاربری وجود دارد", () => {
    expect(read("app/(app)/settings/account/page.tsx")).toContain("ChangePasswordForm");
  });

  it("در سایدبار و کارت‌های تنظیمات لینک دارد", () => {
    expect(read("components/shared/sidebar.tsx")).toContain("/settings/account");
    expect(read("app/(app)/settings/page.tsx")).toContain("/settings/account");
  });

  it("رمز تولیدی ادمین از منبع تصادفی امن می‌آید", () => {
    /*
      Math.random قابل پیش‌بینی است. رمزی که قرار است دست کاربر واقعی
      بیفتد نباید از آن بیاید.
    */
    const page = read("app/(app)/admin/users/page.tsx");
    expect(page).toContain("crypto.getRandomValues");
    expect(page).not.toContain("Math.random()");
  });

  it("مجموعه‌ی نویسه‌ها بدون کاراکتر مبهم است", () => {
    // این رمز معمولاً تلفنی خوانده می‌شود؛ O/0 و l/1 دردسر می‌سازند.
    const page = read("app/(app)/admin/users/page.tsx");
    const m = page.match(/const chars = "([^"]+)"/);
    expect(m).toBeTruthy();
    const chars = m![1];
    for (const bad of ["O", "0", "l", "1", "I"]) {
      expect(chars.includes(bad), `نویسه‌ی مبهم «${bad}» در مجموعه هست`).toBe(false);
    }
  });
});
