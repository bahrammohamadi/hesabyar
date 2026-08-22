import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BACKUP_CODE_COUNT,
  CLOCK_HINT,
  isWellFormedTotp,
  mfaErrorMessage,
  mfaState,
  normalizeTotpInput,
  TOTP_CODE_LENGTH,
  type MfaFactor,
} from "@/lib/security/mfa";

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

describe("نرمال‌سازی کد یک‌بارمصرف", () => {
  /*
    🔴 کاربری که با کیبورد فارسی «۱۲۳۴۵۶» تایپ می‌کند کد **درست** را
    وارد کرده. چون کد TOTP هر ۳۰ ثانیه عوض می‌شود، اگر ردش کنیم او
    فکر می‌کند ساعت گوشی‌اش خراب است و ممکن است کلاً از حسابش قفل
    شود.
  */
  it("ارقام فارسی و عربی تبدیل می‌شوند", () => {
    expect(normalizeTotpInput("۱۲۳۴۵۶")).toBe("123456");
    expect(normalizeTotpInput("١٢٣٤٥٦")).toBe("123456");
  });

  /* بعضی اپ‌ها کد را «۱۲۳ ۴۵۶» نشان می‌دهند و کاربر عیناً کپی می‌کند. */
  it("فاصله و خط تیره حذف می‌شوند", () => {
    expect(normalizeTotpInput("123 456")).toBe("123456");
    expect(normalizeTotpInput("123-456")).toBe("123456");
  });

  it("کد فارسی معتبر شناخته می‌شود", () => {
    expect(isWellFormedTotp("۱۲۳۴۵۶")).toBe(true);
    expect(isWellFormedTotp("123 456")).toBe(true);
  });

  it("طول اشتباه یا حروف رد می‌شود", () => {
    expect(isWellFormedTotp("12345")).toBe(false);
    expect(isWellFormedTotp("1234567")).toBe(false);
    expect(isWellFormedTotp("abcdef")).toBe(false);
    expect(isWellFormedTotp("")).toBe(false);
  });

  it("طول کد شش است", () => {
    expect(TOTP_CODE_LENGTH).toBe(6);
    expect(BACKUP_CODE_COUNT).toBeGreaterThan(0);
  });
});

describe("وضعیت فاکتورها", () => {
  /*
    🔴 فاکتور unverified یعنی کاربر QR را دیده ولی تأیید نکرده —
    یعنی دومرحله‌ای **فعال نیست**. اگر آن را فعال حساب می‌کردیم،
    کاربری که وسط راه پنجره را بست فکر می‌کرد محافظت دارد در حالی
    که ندارد.
  */
  it("فاکتور تأییدنشده یعنی غیرفعال", () => {
    const f: MfaFactor[] = [{ id: "a", status: "unverified" }];
    expect(mfaState(f).enabled).toBe(false);
    expect(mfaState(f).staleIds).toEqual(["a"]);
  });

  it("فاکتور تأییدشده یعنی فعال", () => {
    const f: MfaFactor[] = [{ id: "a", status: "verified" }];
    expect(mfaState(f).enabled).toBe(true);
    expect(mfaState(f).verifiedIds).toEqual(["a"]);
  });

  it("ترکیب هر دو: فعال است ولی نیمه‌کاره‌ها هم شناسایی می‌شوند", () => {
    const f: MfaFactor[] = [
      { id: "a", status: "verified" },
      { id: "b", status: "unverified" },
    ];
    const s = mfaState(f);
    expect(s.enabled).toBe(true);
    expect(s.verifiedIds).toEqual(["a"]);
    expect(s.staleIds).toEqual(["b"]);
  });

  it("فهرست خالی یا تهی خطا نمی‌دهد", () => {
    expect(mfaState([]).enabled).toBe(false);
    expect(mfaState(null).enabled).toBe(false);
    expect(mfaState(undefined).enabled).toBe(false);
  });
});

describe("پیام خطا", () => {
  /*
    پیام خام انگلیسی برای مغازه‌داری که فارسی می‌خواند بی‌معنی است و
    باعث می‌شود فکر کند برنامه خراب شده، نه اینکه کدش اشتباه است.
  */
  it("خطای کد اشتباه فارسی می‌شود", () => {
    expect(mfaErrorMessage("Invalid TOTP code entered")).toMatch(/درست نیست/);
  });

  it("خطای انقضا و نرخ فارسی می‌شوند", () => {
    expect(mfaErrorMessage("challenge expired")).toMatch(/منقضی/);
    expect(mfaErrorMessage("Too many requests")).toMatch(/صبر/);
  });

  it("خطای ناشناخته هم پیام فارسی می‌دهد نه متن خام", () => {
    const msg = mfaErrorMessage("some weird internal thing");
    expect(msg).not.toContain("weird");
    expect(msg.length).toBeGreaterThan(3);
  });

  /*
    🔴 شایع‌ترین علت «کد کار نمی‌کند» ساعت اشتباه گوشی است، نه کد
    اشتباه. بدون این راهنما کاربر بارها تلاش می‌کند و آخرش فکر
    می‌کند برنامه خراب است.
  */
  it("راهنمای اختلاف ساعت وجود دارد", () => {
    expect(CLOCK_HINT).toMatch(/ساعت/);
    expect(CLOCK_HINT.length).toBeGreaterThan(30);
  });
});

describe("🔴 اجبار مرحله‌ی دوم در middleware", () => {
  const mw = readCode("lib/supabase/middleware.ts");

  /*
    🔴 مهم‌ترین ادعای این فایل.

    اندازه‌گیری روی پروژه‌ی زنده:
      • ورود با رمز وقتی TOTP فعال است **موفق می‌شود** و aal1 می‌دهد
      • با همان توکن aal1، خواندن جدول products **مجاز است**

    یعنی Supabase به‌تنهایی جلوی چیزی را نمی‌گیرد؛ فقط سطح را گزارش
    می‌کند. بدون این گارد، ورود دومرحله‌ای صرفاً تزئین است و کاربری
    که فعالش کرده دقیقاً به اندازه‌ی قبل محافظت دارد — یعنی هیچ.
  */
  it("سطح تضمین احراز بررسی می‌شود", () => {
    expect(mw).toMatch(/getAuthenticatorAssuranceLevel\(\)/);
    expect(mw).toMatch(/nextLevel === "aal2"/);
    expect(mw).toMatch(/nextLevel !== aal\.data\.currentLevel/);
  });

  it("کاربر نیازمند مرحله‌ی دوم به صفحه‌ی تأیید می‌رود", () => {
    expect(mw).toMatch(/url\.pathname = "\/mfa"/);
  });

  it("روت API به‌جای ریدایرکت، ۴۰۱ می‌گیرد", () => {
    expect(mw).toMatch(/نیاز به تأیید دومرحله‌ای[\s\S]{0,60}status: 401/);
  });

  /*
    بدون استثنا، حلقه‌ی بی‌نهایت می‌شود: کاربر برای رسیدن به صفحه‌ی
    تأیید باید از گاردی رد شود که خودش او را به همان صفحه می‌فرستد.
  */
  it("خود صفحه‌ی تأیید از گارد مستثناست", () => {
    expect(mw).toMatch(/!path\.startsWith\("\/mfa"\)/);
  });

  /*
    کاربر aal1 باید بتواند شکست مرحله‌ی دوم را ثبت کند، وگرنه حمله
    نامرئی می‌ماند.
  */
  it("روت ثبت رویداد از گارد مستثناست", () => {
    expect(mw).toMatch(/path !== "\/api\/auth\/mfa-event"/);
  });

  /*
    مقصد اصلی نگه داشته می‌شود تا کاربر پس از تأیید به همان صفحه‌ای
    برگردد که می‌خواست، نه همیشه به داشبورد.
  */
  it("مقصد اصلی حفظ می‌شود", () => {
    expect(mw).toMatch(/searchParams\.set\("next", path\)/);
  });
});

describe("صفحه‌ی تأیید و فعال‌سازی", () => {
  const page = readCode("app/mfa/page.tsx");
  const setup = readCode("components/shared/mfa-setup.tsx");
  const lib = readCode("lib/security/mfa.ts");

  /*
    🔴 اگر کاربر گوشی‌اش را گم کرده باشد، بدون راه خروج در صفحه‌ای
    گیر می‌کند که نه می‌تواند ردش کند و نه از آن خارج شود — حتی
    نمی‌تواند با حساب دیگری وارد شود.
  */
  it("صفحه‌ی تأیید راه خروج دارد", () => {
    expect(page).toMatch(/signOut\(\)/);
    expect(page).toMatch(/خروج و ورود با حساب دیگر/);
  });

  /*
    بدون refresh، کوکی نشست با سطح جدید در سرور دیده نمی‌شود و
    middleware همچنان aal1 می‌بیند — حلقه‌ی بی‌پایان.
  */
  it("پس از تأیید نشست تازه می‌شود", () => {
    expect(page).toMatch(/router\.refresh\(\)/);
  });

  it("تلاش ناموفق در سابقه ثبت می‌شود", () => {
    expect(page).toMatch(/mfa-event/);
  });

  /*
    🔴 بدون پاک‌کردن فاکتورهای نیمه‌کاره، کاربری که یک بار پنجره را
    وسط کار بست دفعه‌ی بعد خطای «already exists» می‌گیرد و هیچ راهی
    برای خروج از این بن‌بست ندارد.
  */
  it("فاکتورهای نیمه‌کاره پیش از ثبت تازه پاک می‌شوند", () => {
    expect(setup).toMatch(/for \(const id of state\.staleIds\)[\s\S]{0,120}unenroll/);
  });

  it("کد پیش از تماس با سرور از نظر شکلی سنجیده می‌شود", () => {
    expect(setup).toMatch(/isWellFormedTotp\(clean\)/);
    expect(page).toMatch(/isWellFormedTotp\(clean\)/);
  });

  /*
    ⚠️ این فایل از کامپوننت کلاینت خوانده می‌شود. همان درسی که با
    node:crypto گرفتیم.
  */
  it("منطق دومرحله‌ای هیچ وابستگی به node ندارد", () => {
    expect(lib).not.toMatch(/from "node:/);
    expect(lib).not.toMatch(/require\(/);
  });

  it("کارت فعال‌سازی در صفحه‌ی حساب هست", () => {
    const account = readCode("app/(app)/settings/account/page.tsx");
    expect(account).toMatch(/<MfaSetup \/>/);
  });
});

describe("🔴 بازنشانی دومرحله‌ای توسط مدیر", () => {
  const sql = readCode("supabase/migrations/0052_admin_mfa_reset.sql");
  const route = readCode("app/api/admin/reset-mfa/route.ts");
  const ui = readCode("components/shared/users-access.tsx");

  /*
    حفره‌ای که می‌بندد: اگر کاربر گوشی **و** کدهای پشتیبانش را با
    هم گم کند، هیچ راه خودکاری نبود. کد بازیابی رمز هم کمکی
    نمی‌کرد چون فقط رمز را عوض می‌کند و عامل دوم سر جایش می‌ماند.
  */
  it("تابع بازنشانی وجود دارد", () => {
    expect(sql).toMatch(/create or replace function public\.admin_reset_user_mfa/);
  });

  /*
    🔴 مدیر نباید بتواند 2FA خودش را از این مسیر بردارد.
    وگرنه مدیری که حسابش دزدیده شده، مهاجم با همین دکمه عامل دوم
    را برمی‌دارد.
  */
  it("روی حساب خود مدیر کار نمی‌کند", () => {
    expect(sql).toMatch(/if v_actor = p_user_id then/);
    expect(sql).toMatch(/برای حساب خودتان از صفحه‌ی حساب کاربری اقدام کنید/);
  });

  it("فقط مالک و مدیر همان سازمان", () => {
    expect(sql).toMatch(/role in \('owner','manager'\)/);
    expect(sql).toMatch(/این کاربر عضو مجموعه‌ی شما نیست/);
  });

  /*
    کدهای پشتیبان هم باید پاک شوند، وگرنه یک مجموعه راز بی‌صاحب
    روی حسابی می‌ماند که دیگر 2FA ندارد.
  */
  it("کدهای پشتیبان هم پاک می‌شوند", () => {
    expect(sql).toMatch(/delete from public\.mfa_backup_codes where user_id = p_user_id/);
  });

  /*
    اگر کسی حساب را دزدیده و خودش 2FA گذاشته باشد، صرفِ برداشتن
    عامل دوم بیرونش نمی‌کند.
  */
  it("نشست‌های کاربر بسته می‌شوند", () => {
    expect(sql).toMatch(/delete from auth\.sessions where user_id = p_user_id/);
  });

  it("رویداد در سابقه ثبت می‌شود", () => {
    expect(sql).toMatch(/insert into public\.login_events/);
  });

  /*
    ⚠️ کلاینت درخواست‌محور نه service_role: تابع نقش را با
    auth.uid() می‌سنجد و با کلید سرویس آن تهی است. یعنی حتی اشتباه
    در روت هم گارد نقش را دور نمی‌زند.
  */
  it("روت از کلاینت کاربر استفاده می‌کند نه کلید سرویس", () => {
    expect(route).toMatch(/rpc\("admin_reset_user_mfa"/);
    expect(route).not.toMatch(/serviceClient\(\)/);
  });

  it("روت محدودیت نرخ سختگیرانه دارد", () => {
    expect(route).toMatch(/admin-reset-mfa[\s\S]{0,120}limit: 5/);
  });

  /*
    دکمه فقط برای کاربری که واقعاً 2FA دارد، وگرنه فهرست پر می‌شود
    از دکمه‌ای که هیچ کاری نمی‌کند.
  */
  it("دکمه فقط برای کاربر دارای دومرحله‌ای نشان داده می‌شود", () => {
    expect(ui).toMatch(/\{mfaMap\[u\.user_id\] && \(/);
    expect(ui).toMatch(/rpc\("org_mfa_status"/);
  });

  it("فایل بازگشت وجود دارد", () => {
    const down = read("supabase/rollbacks/0052_admin_mfa_reset.down.sql");
    expect(down).toMatch(/drop function if exists public\.admin_reset_user_mfa/);
  });
});

describe("واحد پول در فروشگاه عمومی", () => {
  const shop = readCode("app/shop/[slug]/page.tsx");

  /*
    🔴 صفحه‌ی عمومی همیشه «تومان» می‌گفت — حتی برای فروشگاهی که کل
    پنلش ریالی بود. یعنی مشتری روی سایت عددی می‌دید که با فاکتور
    نمی‌خواند.

    ⚠️ کامپوننت سروری است و hook نمی‌پذیرد، پس ترجیحات مستقیم از
    دیتابیس خوانده می‌شوند.
  */
  it("فروشگاه دیگر تومان سخت‌کد ندارد", () => {
    expect(shop).not.toMatch(/\bformatToman\(/);
  });

  it("واحد از ترجیحات سازمان خوانده می‌شود", () => {
    expect(shop).toMatch(/key", "org_prefs"/);
    expect(shop).toMatch(/parsePrefs\(prefRow\?\.value\)\.currency/);
    expect(shop).toMatch(/formatMoney\(product\.price, currency\)/);
  });
});
