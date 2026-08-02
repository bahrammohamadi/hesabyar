import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeIranMobile, isValidIranMobile } from "../lib/utils/format";
import { BUSINESS_TYPES, businessTypeLabel, isBusinessType } from "../lib/business-types";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("نرمال‌سازی شماره موبایل", () => {
  it("شکل‌های مختلف ورودی را به یک قالب می‌رساند", () => {
    const expected = "09123456789";
    expect(normalizeIranMobile("09123456789")).toBe(expected);
    expect(normalizeIranMobile("۰۹۱۲۳۴۵۶۷۸۹")).toBe(expected);   // ارقام فارسی
    expect(normalizeIranMobile("٠٩١٢٣٤٥٦٧٨٩")).toBe(expected);   // ارقام عربی
    expect(normalizeIranMobile("0912 345 6789")).toBe(expected); // فاصله
    expect(normalizeIranMobile("0912-345-6789")).toBe(expected); // خط تیره
    expect(normalizeIranMobile("+989123456789")).toBe(expected); // بین‌المللی
    expect(normalizeIranMobile("00989123456789")).toBe(expected);
    expect(normalizeIranMobile("9123456789")).toBe(expected);    // بدون صفر
  });

  it("ورودی نامعتبر را رد می‌کند", () => {
    expect(normalizeIranMobile("12345")).toBeNull();
    expect(normalizeIranMobile("08123456789")).toBeNull(); // با 09 شروع نمی‌شود
    expect(normalizeIranMobile("091234567890")).toBeNull(); // یک رقم اضافه
    expect(normalizeIranMobile("0912345678")).toBeNull();   // یک رقم کم
    expect(normalizeIranMobile("سلام")).toBeNull();
    expect(normalizeIranMobile("")).toBeNull();
    expect(normalizeIranMobile(null)).toBeNull();
  });

  it("isValidIranMobile با normalize هم‌خوان است", () => {
    expect(isValidIranMobile("۰۹۱۲۳۴۵۶۷۸۹")).toBe(true);
    expect(isValidIranMobile("123")).toBe(false);
  });
});

describe("فهرست اصناف", () => {
  it("شناسه‌ها یکتا و غیرخالی‌اند", () => {
    const ids = BUSINESS_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });

  it("برچسب را برمی‌گرداند و ورودی ناشناخته را نمی‌شکند", () => {
    expect(businessTypeLabel("apparel")).toBe("پوشاک");
    expect(businessTypeLabel(null)).toBe("—");
    expect(businessTypeLabel("unknown-x")).toBe("unknown-x");
  });

  it("isBusinessType فقط شناسه‌های واقعی را می‌پذیرد", () => {
    expect(isBusinessType("cafe")).toBe(true);
    expect(isBusinessType("'; drop table--")).toBe(false);
    expect(isBusinessType(42)).toBe(false);
  });
});

describe("migration 0026 — فعال‌سازی فوری", () => {
  const sql = read("supabase/migrations/0026_instant_activation_trial.sql");

  it("سازمان جدید approved ساخته می‌شود، نه pending", () => {
    expect(sql).toContain("'approved',");
    // مقدار pending نباید در insert جدید باشد
    const fn = sql.slice(sql.indexOf("create or replace function public.bootstrap_org"));
    expect(fn).not.toContain("'pending'");
  });

  it("سازمان‌های موجود onboarded علامت می‌خورند", () => {
    // 🔴 بدون این، تمام کاربران فعلی پشت فرم معارفه قفل می‌شدند.
    expect(sql).toContain("update public.organizations");
    expect(sql).toContain("set onboarded_at = created_at");
    expect(sql).toContain("where onboarded_at is null");
  });

  it("از ساخت سازمان دوم برای یک کاربر جلوگیری می‌کند", () => {
    expect(sql).toContain("if v_org is not null then");
    expect(sql).toContain("return v_org;");
  });

  it("طول تست در یک تابع متمرکز است", () => {
    expect(sql).toContain("function public.trial_period_days()");
    expect(sql).toContain("select 14;");
  });

  it("extend_trial فقط برای سوپرادمین و با بازه‌ی معتبر", () => {
    expect(sql).toContain("if v_actor is null or not public.is_platform_admin(v_actor) then");
    expect(sql).toContain("p_days < 1 or p_days > 365");
    // تمدید تستِ منقضی‌شده باید از «الان» باشد نه از تاریخ گذشته
    expect(sql).toContain("greatest(coalesce(trial_ends_at, now()), now())");
  });
});

describe("مسیر ثبت‌نام", () => {
  const register = read("app/register/page.tsx");
  const layout = read("app/(app)/layout.tsx");

  it("صفحه‌ی ثبت‌نام دیگر سازمان نمی‌سازد و به معارفه می‌رود", () => {
    // کامنت‌ها کنار گذاشته می‌شوند؛ توضیحِ «قبلاً bootstrap_org اینجا بود»
    // نباید تست را قرمز کند. فقط فراخوانی واقعی مهم است.
    const code = register
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toContain("bootstrap_org");
    expect(code).toContain('router.push("/onboarding")');
  });

  it("ثبت‌نام از توکن معنایی استفاده می‌کند", () => {
    expect(register).not.toMatch(/slate-|rose-|emerald-/);
  });

  it("layout کاربر بدون سازمان را به معارفه می‌فرستد", () => {
    expect(layout).toContain('redirect("/onboarding")');
  });

  it("layout معارفه‌ی ناتمام را تشخیص می‌دهد", () => {
    expect(layout).toContain("onboarded_at");
    expect(layout).toContain("org.onboarded_at === null");
  });
});
