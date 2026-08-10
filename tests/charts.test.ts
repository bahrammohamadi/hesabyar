import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { compactAxisNumber, tickInterval } from "@/src/shared/ui/chart-utils";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*(\/\/|--).*$/gm, "");

/** همه‌ی فایل‌هایی که واقعاً نمودار می‌کشند. */
function chartFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(root, dir))) {
      const rel = `${dir}/${entry}`;
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else if (entry.endsWith(".tsx") && read(rel).includes("recharts")) out.push(rel);
    }
  };
  walk("app");
  walk("components");
  return out;
}

describe("🔴 ارقام فارسی در محور نمودار", () => {
  /*
    اندازه‌گیری واقعی روی داشبورد و /reports پیش از این اصلاح:
      تیک‌های محور Y →  0k · 850k · 1.7M · 2.55M · 3.4M

    ارقام لاتین با پسوند انگلیسی، در برنامه‌ای که همه‌جایش فارسی
    است. تابع compactAxisNumber که «۱٫۷ م» می‌سازد از قبل وجود
    داشت ولی فقط در یکی از سه فایل نمودار استفاده می‌شد.
  */
  it("compactAxisNumber رقم فارسی با پسوند فارسی می‌دهد", () => {
    expect(compactAxisNumber(1_700_000)).toBe("۱.۷ م");
    expect(compactAxisNumber(850_000)).toBe("۸۵۰ هـ");
    expect(compactAxisNumber(0)).toBe("۰");
    expect(compactAxisNumber(2_500_000_000)).toBe("۲.۵ میلیارد");
  });

  it("عدد گرد، اعشار اضافه نمی‌گیرد", () => {
    // «۲ م» نه «۲.۰ م»
    expect(compactAxisNumber(2_000_000)).toBe("۲ م");
  });

  it("عدد منفی هم درست کوتاه می‌شود", () => {
    expect(compactAxisNumber(-1_500_000)).toBe("-۱.۵ م");
  });

  it("🔴 هیچ نموداری فرمت‌کننده‌ی لاتین دست‌ساز ندارد", () => {
    /*
      الگوی خطرناک: `${v / 1000000}M` یا `${v / 1000}k`
      این دقیقاً همان چیزی بود که «0k» و «3.4M» را می‌ساخت.
    */
    for (const file of chartFiles()) {
      const code = readCode(file);
      expect(code, `${file}: پسوند M دست‌ساز`).not.toMatch(/\$\{[^}]*\/\s*1_?000_?000\}M/);
      expect(code, `${file}: پسوند k دست‌ساز`).not.toMatch(/\$\{[^}]*\/\s*1_?000\}k/);
    }
  });

  it("هر نموداری که محور عددی دارد از compactAxisNumber استفاده می‌کند", () => {
    for (const file of chartFiles()) {
      const code = readCode(file);
      if (!code.includes("tickFormatter")) continue;
      expect(code, `${file}`).toContain("compactAxisNumber");
    }
  });
});

describe("🔴 استفاده از قطعات مشترک ChartKit", () => {
  /*
    دو فایل از سه فایل نمودار، نسخه‌ی دست‌ساز خودشان را داشتند:
    گرادیان محلی، contentStyle محلی، بدون اسکلت بارگذاری و بدون
    احترام به prefers-reduced-motion.
  */
  it("همه‌ی فایل‌های نمودار از ChartKit استفاده می‌کنند", () => {
    for (const file of chartFiles()) {
      const code = readCode(file);
      expect(code, `${file} از ChartKit استفاده نمی‌کند`).toMatch(
        /axisProps|ChartTooltip|chartGradients|useChartAnimation/
      );
    }
  });

  it("انیمیشن به prefers-reduced-motion احترام می‌گذارد", () => {
    /*
      Recharts انیمیشن را در جاوااسکریپت اجرا می‌کند؛ بلوک سراسری
      CSS خنثی‌اش نمی‌کند و باید صریح خاموش شود.
    */
    for (const file of chartFiles()) {
      const code = readCode(file);
      if (!/(<Area|<Line|<Bar)\b/.test(code)) continue;
      expect(code, `${file}: isAnimationActive ندارد`).toContain("isAnimationActive");
    }
  });

  it("🔴 هیچ contentStyle دست‌ساز برای Tooltip نمانده", () => {
    /*
      با contentStyle فقط ظاهر جعبه تنظیم می‌شود و مقدارها با ارقام
      لاتین رندر می‌شوند. ChartTooltip هم رقم را فارسی می‌کند و هم
      تاریخ را شمسی.
    */
    for (const file of chartFiles()) {
      expect(readCode(file), `${file}`).not.toContain("contentStyle=");
    }
  });

  it("حالت بارگذاری و خالی طراحی‌شده دارند", () => {
    for (const file of ["app/(app)/dashboard/components/DashboardSalesChart.tsx"]) {
      const code = readCode(file);
      expect(code, `${file}: ChartSkeleton`).toContain("ChartSkeleton");
      expect(code, `${file}: ChartEmpty`).toContain("ChartEmpty");
    }
  });
});

describe("ChartTooltip مشترک", () => {
  const kit = readCode("src/shared/ui/ChartKit.tsx");

  it("رقم را فارسی می‌کند", () => {
    expect(kit).toContain("toFaDigits");
  });

  it("تاریخ را شمسی می‌کند", () => {
    // تاریخ خام از دیتابیس میلادی است.
    expect(kit).toContain("toJalali(raw)");
    expect(kit).toContain("toJalaliMonth(raw)");
  });

  it("🔴 جهت راست‌به‌چپ دارد", () => {
    /*
      ظرف نمودار dir="ltr" است (Recharts در RTL محور را برعکس
      می‌کشد)، پس خودِ جعبه باید صریح rtl شود.
    */
    const idx = kit.indexOf("export function ChartTooltip");
    expect(kit.slice(idx, idx + 2000)).toContain('dir="rtl"');
  });

  it("بدون داده چیزی رندر نمی‌کند", () => {
    expect(kit).toContain("if (!active || !payload?.length) return null");
  });

  it("از توکن معنایی استفاده می‌کند نه رنگ خام", () => {
    const idx = kit.indexOf("export function ChartTooltip");
    const body = kit.slice(idx, idx + 2000);
    expect(body).toContain("bg-popover");
    expect(body).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});

describe("فاصله‌ی تیک محور X", () => {
  it("نقاط کم، همه‌ی تیک‌ها را نشان می‌دهد", () => {
    expect(tickInterval(4, false)).toBe(0);
    expect(tickInterval(3, true)).toBe(0);
  });

  it("🔴 روی موبایل تیک کمتری نشان می‌دهد", () => {
    /*
      با ۳۰ نقطه روی موبایل، برچسب‌ها روی هم می‌افتند و Recharts
      بعضی را بی‌قاعده حذف می‌کند.
    */
    const mobile = tickInterval(30, true);
    const desktop = tickInterval(30, false);
    expect(mobile).toBeGreaterThan(desktop);
  });

  it("خروجی همیشه عدد صحیح نامنفی است", () => {
    for (const n of [0, 1, 7, 30, 365]) {
      for (const m of [true, false]) {
        const v = tickInterval(n, m);
        expect(Number.isInteger(v), `${n}/${m}`).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("خلاصه‌ی عددی داشبورد", () => {
  const chart = readCode("app/(app)/dashboard/components/DashboardSalesChart.tsx");

  it("جمع دوره و بیشترین روز نشان داده می‌شود", () => {
    /*
      کاربر معمولاً دنبال «چقدر فروختم» است نه شکل منحنی؛ خواندن
      عدد از روی نمودار کار اضافه است.
    */
    expect(chart).toContain("جمع دوره");
    expect(chart).toContain("بیشترین روز");
  });

  it("🔴 matchMedia در useEffect خوانده می‌شود نه هنگام رندر", () => {
    /*
      خواندن هنگام رندر بین سرور و کلاینت اختلاف می‌سازد
      (hydration mismatch).
    */
    const idx = chart.indexOf("matchMedia");
    const before = chart.slice(Math.max(0, idx - 300), idx);
    expect(before).toContain("useEffect");
  });

  it("listener پاک‌سازی می‌شود", () => {
    expect(chart).toContain("removeEventListener");
  });
});

describe("🔴 جداسازی مبلغ و تاریخ در خلاصه", () => {
  /*
    در اسکرین‌شات واقعی دیده شد: «۳۳۷,۵۰۰۰۵/۰۳».
    مبلغ ۳۳۷٬۵۰۰ و تاریخ ۰۵/۰۳ به هم چسبیده بودند و یک عدد واحد
    به نظر می‌رسیدند. علت: فقط `mr-1.5` بین دو عنصر inline بود و
    در چیدمان راست‌به‌چپ با ارقام فارسی، مرز دیده نمی‌شد.

    نه tsc، نه build و نه axe چنین چیزی را نمی‌گیرند — فقط نگاه
    کردن به تصویر.
  */
  const chart = readCode("app/(app)/dashboard/components/DashboardSalesChart.tsx");

  it("مبلغ و تاریخ در عنصرهای جدا با flex هستند", () => {
    expect(chart).toContain("flex items-baseline gap-1.5");
  });

  it("جداکننده‌ی دیداری دارد", () => {
    expect(chart).toContain("·");
  });

  it("جداکننده برای صفحه‌خوان پنهان است", () => {
    // «·» معنایی ندارد و خواندنش فقط مزاحم است.
    expect(chart).toMatch(/aria-hidden[^>]*>·|·[\s\S]{0,20}aria-hidden/);
  });
});
