import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const readCode = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(\/\/|--).*$/gm, "");

describe("🔴 ویرایش نام کاربر", () => {
  const api = readCode("app/api/account/profile/route.ts");
  const adminApi = readCode("app/api/admin/users/profile/route.ts");

  it("نام در هر دو جای ذخیره‌سازی به‌روز می‌شود", () => {
    /*
      نام در دو جا نگهداری می‌شود:
        auth.users.user_metadata.name  ← حساب‌های ساخته‌شده توسط ادمین
        organizations.owner_full_name  ← ثبت‌نام‌های خودکار
      هدر از هر دو می‌خواند. اگر فقط یکی به‌روز شود، کاربر نام قدیمی را
      جایی می‌بیند و فکر می‌کند ذخیره نشده.
    */
    for (const src of [api, adminApi]) {
      expect(src).toContain("updateUserById");
      expect(src).toContain("owner_full_name: fullName");
    }
  });

  it("🔴 به‌روزرسانی سازمان به مالک محدود است", () => {
    /*
      بدون شرط owner_id، یک UPDATE بدون فیلتر نام مالک *همه‌ی*
      سازمان‌ها را عوض می‌کرد. همین دسته اشتباه یک بار در هدر رخ داد
      و نام یک کسب‌وکار در حساب دیگری دیده شد.
    */
    expect(api).toContain('.eq("owner_id", user.id)');
    expect(adminApi).toContain('.eq("owner_id", userId)');
  });

  it("شماره‌ی موبایل یکدست می‌شود", () => {
    // وگرنه «۰۹۱۲…» و «+98912…» دو مقدار متفاوت ذخیره می‌شوند و
    // جستجوی پشتیبانی یکی را پیدا نمی‌کند.
    for (const src of [api, adminApi]) {
      expect(src).toContain("normalizeIranMobile");
    }
  });

  it("شماره‌ی نامعتبر رد می‌شود، ولی خالی مجاز است", () => {
    expect(api).toContain("if (rawPhone)");
    expect(api).toContain("شماره موبایل معتبر نیست");
  });

  it("نام خیلی کوتاه یا خیلی بلند رد می‌شود", () => {
    expect(api).toContain("fullName.length < 2");
    expect(api).toContain("MAX_NAME");
  });

  it("🔴 مسیر ادمین دلیل اجباری دارد", () => {
    // تغییر داده‌ی حساب مشتری بدون توضیح، در ممیزی غیرقابل‌دفاع است.
    expect(adminApi).toContain("reason.length < 5");
    expect(adminApi).toContain('p_action: "user.profile_updated"');
  });

  it("🔴 مسیر ادمین مجوز نوشتن می‌خواهد نه خواندن", () => {
    /*
      با users.view هر ادمینِ فقط‌خواننده می‌توانست نام کاربران را
      عوض کند. این کار از جنس «تغییر حساب» است.
    */
    expect(adminApi).toContain('requirePlatformPermission("users.password")');
  });

  it("هر دو روت سقف نرخ دارند", () => {
    for (const src of [api, adminApi]) expect(src).toContain("tooManyRequests");
  });

  it("فرم در صفحه‌ی حساب کاربری رندر می‌شود", () => {
    expect(readCode("app/(app)/settings/account/page.tsx")).toContain("<ProfileForm />");
  });

  it("پس از ذخیره، کش هدر باطل می‌شود", () => {
    // بدون این، نام قدیمی تا رفرش بعدی بالای صفحه می‌ماند.
    const form = readCode("components/shared/profile-form.tsx");
    expect(form).toContain('queryKey: ["account-current-user"]');
  });

  it("🔴 نوشته‌ی نیمه‌کاره‌ی کاربر پاک نمی‌شود", () => {
    /*
      بدون پرچم touched، هر بار که کوئری دوباره اجرا می‌شد (مثلاً با
      برگشتن به تب) مقدار سرور روی نوشته‌ی کاربر می‌نشست.
    */
    const form = readCode("components/shared/profile-form.tsx");
    expect(form).toContain("if (data && !touched)");
  });

  it("دکمه‌ی ویرایش در پنل ادمین هست", () => {
    expect(readCode("app/(app)/admin/users/page.tsx")).toContain("ویرایش نام");
  });
});

describe("🔴 خروجی گزارش‌ها: تاریخ شمسی و مبلغ تومان", () => {
  const page = readCode("app/(app)/reports/page.tsx");

  it("تاریخ‌ها شمسی صادر می‌شوند", () => {
    /*
      پیش از این `date: s.date` خام میلادی («2026-08-05T…») صادر
      می‌شد، در حالی که کل برنامه تاریخ شمسی نشان می‌دهد. کاربری که
      فایل را در اکسل باز می‌کرد تاریخ‌هایی ناآشنا می‌دید.
    */
    expect(page).toContain('"تاریخ": toJalali(s.date)');
    expect(page).toContain('"تاریخ": toJalali(t.date)');
    expect(page).not.toMatch(/\bdate:\s*s\.date\b/);
    expect(page).not.toMatch(/\bdate:\s*t\.date\b/);
  });

  it("🔴 مبالغ به تومان صادر می‌شوند نه ریال", () => {
    /*
      دیتابیس ریال ذخیره می‌کند ولی همه‌جای برنامه تومان نشان داده
      می‌شود. خروجی ریالی یعنی اعداد ده‌برابر و کاربر باید دستی
      تبدیل کند.
    */
    expect(page).toContain('"مبلغ کل (تومان)": rialToToman(s.total ?? 0)');
    expect(page).toContain('"قیمت فروش (تومان)": rialToToman(v.sale_price ?? 0)');
    expect(page).toContain('"مبلغ (تومان)": rialToToman(t.amount ?? 0)');
  });

  it("سرستون‌ها فارسی‌اند", () => {
    // کاربر فارسی‌زبان نباید با «invoice_no» روبه‌رو شود.
    expect(page).toContain('"شماره فاکتور"');
    expect(page).toContain('"مشتری"');
  });

  it("نام فایل هم تاریخ شمسی دارد", () => {
    expect(page).toContain("todayJalali()");
  });
});
