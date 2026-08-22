import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatBackupCode,
  generateBackupCodes,
  hashBackupCode,
  isWellFormedBackupCode,
  normalizeBackupCode,
} from "@/lib/security/backup-codes";
import { BACKUP_CODE_COUNT } from "@/lib/security/mfa";

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

describe("تولید کد پشتیبان", () => {
  it("تعداد درست تولید می‌شود", () => {
    expect(generateBackupCodes()).toHaveLength(BACKUP_CODE_COUNT);
    expect(generateBackupCodes(5)).toHaveLength(5);
  });

  it("کدها یکتا هستند", () => {
    const codes = generateBackupCodes(10);
    expect(new Set(codes).size).toBe(10);
  });

  /*
    🔴 حروف و ارقام مبهم عمداً حذف شده‌اند: 0/O، 1/I/l، 5/S، 2/Z، 8/B.
    کاربر این کد را از روی **کاغذ** می‌خواند؛ یک اشتباه خواندن یعنی
    سوختن یکی از پنج تلاش، و در بدترین حالت قفل‌شدن حسابی که همین
    کد قرار بود نجاتش دهد.
  */
  it("نویسه‌های مبهم در کد نیستند", () => {
    const all = generateBackupCodes(40).join("");
    for (const bad of ["0", "O", "1", "I", "L", "5", "S", "2", "Z", "8", "B"]) {
      expect(all, `نویسه‌ی مبهم ${bad} در کد آمده`).not.toContain(bad);
    }
  });

  it("طول هر کد ده نویسه است", () => {
    for (const c of generateBackupCodes(20)) {
      expect(c).toHaveLength(10);
    }
  });

  /*
    ۲۵ نویسه‌ی ممکن به توان ۱۰ ≈ ۴۶ بیت. این تست تصادفی‌بودن را
    اثبات نمی‌کند ولی مولد ثابت یا شمارنده‌ای را می‌گیرد.
  */
  it("توزیع نویسه‌ها متنوع است", () => {
    const chars = new Set(generateBackupCodes(30).join(""));
    expect(chars.size).toBeGreaterThan(15);
  });
});

describe("هش کد پشتیبان", () => {
  it("همان ورودی همان هش را می‌دهد", () => {
    expect(hashBackupCode("ABCD", "u1", "p")).toBe(hashBackupCode("ABCD", "u1", "p"));
  });

  /*
    🔴 نمک per-user.

    NIST می‌گوید کدهای با آنتروپی کمتر از ۱۱۲ بیت باید نمک‌دار
    باشند. بدون آن، دو کاربر با کد یکسان هش یکسان می‌گرفتند و یک
    جدول رنگین‌کمانی همه را با هم می‌شکست.
  */
  it("کاربران متفاوت هش متفاوت می‌گیرند", () => {
    expect(hashBackupCode("ABCD", "u1", "p")).not.toBe(hashBackupCode("ABCD", "u2", "p"));
  });

  it("فلفل متفاوت هش متفاوت می‌دهد", () => {
    expect(hashBackupCode("ABCD", "u1", "a")).not.toBe(hashBackupCode("ABCD", "u1", "b"));
  });

  it("کد خام در هش دیده نمی‌شود", () => {
    expect(hashBackupCode("ACDEFGHJKM", "u1", "p")).not.toContain("ACDEFGHJKM");
  });

  /*
    کاربر کد را از کاغذ می‌خواند و ممکن است با فاصله، خط تیره یا
    حروف کوچک بنویسد. رد کردن این‌ها یعنی مجازات کردن کاربری که کد
    **درست** را وارد کرده.
  */
  it("قالب و حروف کوچک نتیجه را عوض نمی‌کنند", () => {
    const base = hashBackupCode("ACDEFGHJKM", "u1", "p");
    expect(hashBackupCode("acdefghjkm", "u1", "p")).toBe(base);
    expect(hashBackupCode("ACDE-FGHJ-KM", "u1", "p")).toBe(base);
    expect(hashBackupCode(" ACDE FGHJ KM ", "u1", "p")).toBe(base);
  });
});

describe("نرمال‌سازی و اعتبارسنجی", () => {
  it("خط تیره و فاصله حذف و بزرگ می‌شوند", () => {
    expect(normalizeBackupCode("acde-fghj-km")).toBe("ACDEFGHJKM");
    expect(normalizeBackupCode("ACDE FGHJ KM")).toBe("ACDEFGHJKM");
  });

  it("کد درست معتبر شناخته می‌شود", () => {
    for (const c of generateBackupCodes(10)) {
      expect(isWellFormedBackupCode(c)).toBe(true);
      expect(isWellFormedBackupCode(formatBackupCode(c))).toBe(true);
      expect(isWellFormedBackupCode(c.toLowerCase())).toBe(true);
    }
  });

  it("طول اشتباه رد می‌شود", () => {
    expect(isWellFormedBackupCode("ACDEFGHJK")).toBe(false);
    expect(isWellFormedBackupCode("ACDEFGHJKMN")).toBe(false);
    expect(isWellFormedBackupCode("")).toBe(false);
  });

  /*
    نویسه‌ی خارج از الفبا یعنی کاربر اشتباه خوانده (مثلاً O به‌جای
    Q). رد کردنش پیش از تماس با سرور، سهمیه‌ی محدود او را نمی‌سوزاند.
  */
  it("نویسه‌ی خارج از الفبا رد می‌شود", () => {
    expect(isWellFormedBackupCode("ACDEFGHJK0")).toBe(false);
    expect(isWellFormedBackupCode("ACDEFGHJK1")).toBe(false);
    expect(isWellFormedBackupCode("!@#$%^&*()")).toBe(false);
  });

  /*
    خواندن گروه‌های چهارتایی از کاغذ بسیار کم‌خطاتر از یک رشته‌ی
    ۱۰ نویسه‌ای پیوسته است.
  */
  it("قالب‌بندی گروه چهارتایی می‌سازد", () => {
    expect(formatBackupCode("ACDEFGHJKM")).toBe("ACDE-FGHJ-KM");
    expect(formatBackupCode("ACDE-FGHJ-KM")).toBe("ACDE-FGHJ-KM");
  });
});

describe("همسانی با مهاجرت ۰۰۵۱", () => {
  const sql = readCode("supabase/migrations/0051_backup_codes_and_preferences.sql");

  /*
    🔴 NIST SP 800-63B §4.2.1.1: کدها SHALL هش‌شده ذخیره شوند.
    کد خام یعنی نشت پشتیبان = دور زدن کامل دومرحله‌ای.
  */
  it("کد هش‌شده ذخیره می‌شود", () => {
    expect(sql).toMatch(/code_hash\s+text not null/);
    expect(sql).not.toMatch(/\bcode\s+text not null\b/);
  });

  it("جدول برای کاربر عادی خوانا نیست", () => {
    expect(sql).toMatch(/alter table public\.mfa_backup_codes enable row level security/);
    expect(sql).toMatch(/revoke all on public\.mfa_backup_codes from anon, authenticated/);
  });

  /*
    ساخت مجموعه‌ی تازه باید قبلی‌ها را کاملاً باطل کند، وگرنه دو
    مجموعه‌ی معتبر همزمان وجود دارد و یکی‌شان احتمالاً جایی رها شده.
  */
  it("ساخت تازه، مجموعه‌ی قبلی را پاک می‌کند", () => {
    expect(sql).toMatch(/delete from public\.mfa_backup_codes where user_id = p_user_id/);
  });

  it("کد پس از مصرف سوزانده می‌شود", () => {
    expect(sql).toMatch(/update public\.mfa_backup_codes set used_at = now\(\)/);
    expect(sql).toMatch(/and used_at is null/);
  });

  /* ترجیحات باید ادغام شوند نه جایگزین، وگرنه ذخیره‌ی یک فرم
     تنظیمات فرم دیگر را پاک می‌کند. */
  it("ترجیحات ادغام می‌شوند نه جایگزین", () => {
    expect(sql).toMatch(/set value = public\.settings\.value \|\| coalesce\(excluded\.value/);
  });

  /* تغییر واحد پول روی نمایش همه‌ی کاربران سازمان اثر دارد. */
  it("تنظیمات فقط با نقش مالک یا مدیر ذخیره می‌شود", () => {
    expect(sql).toMatch(/v_role not in \('owner','manager'\)/);
  });

  it("نوشتن در فهرست گزینه‌ها محدود به مالک و مدیر است", () => {
    expect(sql).toMatch(/create policy option_lists_write[\s\S]{0,400}role in \('owner','manager'\)/);
  });

  it("گزینه‌ی تکراری با یکتایی جلویش گرفته شده", () => {
    expect(sql).toMatch(/unique \(org_id, kind, value\)/);
  });

  it("فایل بازگشت هشدار می‌دهد", () => {
    const down = read("supabase/rollbacks/0051_backup_codes_and_preferences.down.sql");
    expect(down).toMatch(/drop table if exists public\.mfa_backup_codes/);
    expect(down).toMatch(/هشدار/);
  });
});

describe("روت کدهای پشتیبان", () => {
  const route = readCode("app/api/auth/backup-codes/route.ts");

  /*
    🔴 بدون این چک، کاربری بدون 2FA هم می‌توانست ده کد بسازد که
    هیچ کاری نمی‌کنند — و بعد فکر کند محافظت اضافه‌ای دارد.
  */
  it("ساخت کد نیازمند دومرحله‌ای فعال است", () => {
    expect(route).toMatch(/status === "verified"/);
    expect(route).toMatch(/ابتدا ورود دومرحله‌ای را فعال کنید/);
  });

  it("مصرف کد محدودیت نرخ سختگیرانه دارد", () => {
    expect(route).toMatch(/backup-codes-use[\s\S]{0,120}limit: 5/);
  });

  it("شکل کد پیش از تماس با دیتابیس سنجیده می‌شود", () => {
    expect(route).toMatch(/isWellFormedBackupCode\(raw\)/);
  });

  it("تلاش ناموفق در سابقه ثبت می‌شود", () => {
    expect(route).toMatch(/mfa_failure/);
  });

  /*
    سطح تضمین در توکن Supabase امضا شده و از بیرون قابل ارتقا
    نیست. تنها راه رسمی، حذف فاکتور و ورود با رمز است — همان
    رفتاری که GitHub و Google دارند.
  */
  it("پس از مصرف کد، فاکتور دومرحله‌ای حذف می‌شود", () => {
    expect(route).toMatch(/unenroll\(\{ factorId: f\.id \}\)/);
    expect(route).toMatch(/mfaDisabled: true/);
  });
});
