import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toJalaliShort, toJalaliMonth, toJalali } from "../lib/utils/format";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("قالب‌های تاریخ شمسی برای نمودار", () => {
  it("toJalaliShort فقط ماه/روز با ارقام فارسی می‌دهد", () => {
    const out = toJalaliShort("2026-07-12");
    expect(out).toMatch(/^[۰-۹]{2}\/[۰-۹]{2}$/);
    // نباید رقم لاتین یا سال داشته باشد؛ محور X جای کمی دارد.
    expect(out).not.toMatch(/[0-9]/);
    expect(out.length).toBe(5);
  });

  it("toJalaliMonth نام ماه شمسی می‌دهد", () => {
    const out = toJalaliMonth("2026-07-12");
    expect(out).toContain("۱۴۰۵");
    expect(out).toMatch(/^(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند) /);
  });

  it("ورودی خالی یا خراب رشته‌ی خالی می‌دهد نه خطا", () => {
    for (const bad of [null, undefined, "", "چرند"]) {
      expect(() => toJalaliShort(bad as never)).not.toThrow();
      expect(() => toJalaliMonth(bad as never)).not.toThrow();
    }
    expect(toJalaliShort(null)).toBe("");
    expect(toJalaliMonth(undefined)).toBe("");
  });

  it("toJalali هیچ تاریخ میلادی برنمی‌گرداند", () => {
    const out = toJalali("2026-07-12");
    expect(out).not.toContain("2026");
    expect(out).toContain("۱۴۰۵");
  });
});

describe("نمودارهای گزارش — تقویم فارسی", () => {
  const page = read("app/(app)/reports/overview-v2/page.tsx");

  it("محورهای تاریخ tickFormatter شمسی دارند", () => {
    // بدون tickFormatter، Recharts مقدار خام «2026-07-12» را چاپ می‌کرد.
    expect(page).toContain('dataKey="date" tick={{ fontSize: 12 }} tickFormatter={toJalaliShort}');
    expect(page).toContain('dataKey="month" tick={{ fontSize: 12 }} tickFormatter={toJalaliMonth}');
  });

  it("تولتیپ هم تاریخ را شمسی می‌کند", () => {
    // فقط محور کافی نیست؛ label تولتیپ هم خام چاپ می‌شد.
    expect(page).toContain('labelKind="day"');
    expect(page).toContain('labelKind="month"');
    expect(page).toContain('labelKind === "day" ? toJalali(label)');
  });

  it("ارقام محور Y فارسی است", () => {
    expect(page).toContain("tickFormatter={(v) => toPersianDigits(v)}");
  });

  it("تولتیپ از توکن معنایی استفاده می‌کند نه bg-white", () => {
    const tt = page.slice(page.indexOf("function ChartTooltip"), page.indexOf("function DailySalesSection"));
    expect(tt).not.toContain("bg-white");
    expect(tt).toContain("bg-card");
  });
});

describe("چیدمان فرم فاکتور — بر پایه‌ی ظرف", () => {
  const form = read("src/shared/panels/InvoiceCreateForm.tsx");
  const css = read("app/globals.css");

  it("دیگر به بریک‌پوینت پنجره وابسته نیست", () => {
    /*
      🔴 باگ اصلی: lg:grid-cols به عرض پنجره نگاه می‌کرد، ولی فرم داخل
      پنل ۵۶۰px رندر می‌شود. روی دسکتاپ ۱۴۴۰px دو ستون می‌شد و
      ۳۴۰px از ۵۶۰px به ستون کناری می‌رفت.
    */
    expect(form).not.toContain("lg:grid-cols-[minmax(0,1fr)_340px]");
    expect(form).not.toContain("hidden lg:block");
  });

  it("از کلاس‌های container query استفاده می‌کند", () => {
    expect(form).toContain("invoice-form-scope");
    expect(form).toContain("invoice-form-grid");
    expect(form).toContain("invoice-step-hidden");
    expect(form).toContain("invoice-steps-tabs");
  });

  it("CSS ظرف را تعریف کرده و آستانه‌ی منطقی دارد", () => {
    expect(css).toContain("container-type: inline-size");
    expect(css).toContain("@container invoiceform (min-width: 860px)");
  });

  it("برای مرورگر بدون container query جایگزین دارد", () => {
    expect(css).toContain("@supports not (container-type: inline-size)");
  });
});

describe("دسترس‌پذیری — ایرادهای از قبل موجود", () => {
  it("دکمه‌های فقط-آیکون نام دسترس‌پذیر دارند", () => {
    // زیر بریک‌پوینت sm برچسب متنی پنهان می‌شود.
    expect(read("app/(app)/sales/page.tsx")).toContain('aria-label="فروش جدید"');
    expect(read("app/(app)/dashboard/page.tsx")).toContain('aria-label="فروش جدید"');
    expect(read("components/shared/header.tsx")).toContain('aria-label="خروج از حساب"');
  });

  it("کارت موبایل جدول button تودرتو نمی‌سازد", () => {
    // کارت منوی عملیات (button) داخل خود دارد؛ role=button تودرتویی
    // نامعتبر می‌ساخت (nested-interactive، ۲۰ مورد در /sales).
    const table = read("src/shared/ui/Table.tsx");
    expect(table).toContain('role={clickable ? "link" : undefined}');
    expect(table).not.toContain('role={clickable ? "button" : undefined}');
  });

  it("li داخل ul نقش listitem را از دست نمی‌دهد", () => {
    // بازنویسی نقش li باعث می‌شد ul هیچ فرزند معتبری نداشته باشد.
    for (const p of ["app/(app)/products/page.tsx", "app/(app)/contacts/page.tsx"]) {
      const src = read(p);
      expect(src).not.toMatch(/<li\s*\n\s*key=\{[^}]+\}\s*\n\s*role="link"/);
    }
  });
});
