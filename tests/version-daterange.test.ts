import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { withinRange, EMPTY_RANGE } from "../src/shared/ui/date-range-utils";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("نسخه‌گذاری خودکار", () => {
  it("فایل نسخه تولید شده و ثابت متنی است", () => {
    /*
      🔴 تلاش اول با بلوک `env` در next.config شکست خورد: آن بلوک فقط
      رخدادهای *لفظی* process.env.X را جایگزین می‌کند. وقتی مقدار از
      ماژول مشترک با الگوی `process.env.X ?? "1.0"` خوانده می‌شد،
      بسته‌بند آن را به ارجاع زمان‌اجرا تبدیل می‌کرد و روی سرور مقدار
      پیش‌فرض برمی‌گشت.
      (در باندل به‌جای عدد، `version:u.Gx` دیده می‌شد و API نسخه‌ی
      «1.0/dev» می‌داد در حالی که بیلد 1.223 بود.)
    */
    const p = join(root, "lib/version.generated.ts");
    expect(existsSync(p)).toBe(true);
    const src = readFileSync(p, "utf8");
    expect(src).toMatch(/export const APP_VERSION = "1\.\d+"/);
    expect(src).not.toContain("process.env");
  });

  it("brand از فایل تولیدی می‌خواند نه مقدار دستی", () => {
    const brand = read("lib/brand.ts");
    expect(brand).toContain('from "./version.generated"');
    expect(brand).not.toMatch(/BRAND_VERSION = "۱\.۰"/);
  });

  it("prebuild خودکار اجرا می‌شود", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts.prebuild).toBe("node scripts/gen-version.mjs");
  });

  it("فایل تولیدی در گیت می‌ماند تا بیلد بدون prebuild نشکند", () => {
    expect(read(".gitignore")).not.toContain("version.generated");
  });

  it("مسیر /api/version پیش از ورود هم باز است", () => {
    // وگرنه بررسی به‌روزرسانی در صفحه‌ی ورود ۴۰۱ می‌گیرد.
    expect(read("lib/supabase/middleware.ts")).toContain('path === "/api/version"');
  });

  it("اعلان به‌روزرسانی خودکار رفرش نمی‌کند", () => {
    // کاربر ممکن است وسط فاکتور باشد؛ رفرش ناگهانی یعنی از دست رفتن کار.
    const src = read("components/shared/update-prompt.tsx");
    expect(src).toContain("window.location.reload()");
    expect(src).toContain('onClick={() => window.location.reload()}');
    // فقط با کلیک کاربر
    expect(src).not.toMatch(/useEffect\([^)]*\)\s*=>\s*\{\s*window\.location\.reload/);
  });
});

describe("فیلتر بازه‌ی تاریخ", () => {
  it("بازه‌ی خالی همه‌چیز را نگه می‌دارد", () => {
    expect(withinRange("2026-08-03", EMPTY_RANGE)).toBe(true);
    expect(withinRange(null, EMPTY_RANGE)).toBe(true);
  });

  it("مرزها شامل هستند", () => {
    const r = { from: "2026-08-01", to: "2026-08-31" };
    expect(withinRange("2026-08-01", r)).toBe(true);   // شروع
    expect(withinRange("2026-08-31", r)).toBe(true);   // پایان
    expect(withinRange("2026-07-31", r)).toBe(false);
    expect(withinRange("2026-09-01", r)).toBe(false);
  });

  it("timestamp کامل روز پایانی را از قلم نمی‌اندازد", () => {
    /*
      اگر مقایسه روی کل رشته انجام شود، «2026-08-31T14:00:00Z» بزرگ‌تر
      از «2026-08-31» است و رکورد حذف می‌شد. برش ۱۰ نویسه‌ی اول این
      را حل می‌کند.
    */
    const r = { from: "2026-08-01", to: "2026-08-31" };
    expect(withinRange("2026-08-31T14:22:00Z", r)).toBe(true);
    expect(withinRange("2026-08-01T00:00:00.000Z", r)).toBe(true);
  });

  it("فقط یک سر بازه هم کار می‌کند", () => {
    expect(withinRange("2026-08-15", { from: "2026-08-01", to: "" })).toBe(true);
    expect(withinRange("2026-07-15", { from: "2026-08-01", to: "" })).toBe(false);
    expect(withinRange("2026-07-15", { from: "", to: "2026-08-01" })).toBe(true);
  });

  it("تاریخ خالی با بازه‌ی فعال رد می‌شود", () => {
    expect(withinRange(null, { from: "2026-08-01", to: "" })).toBe(false);
  });
});

describe("یکپارچگی فیلتر با صفحه‌ها", () => {
  for (const [file, label] of [
    ["app/(app)/sales/page.tsx", "فروش"],
    ["app/(app)/purchases/page.tsx", "خرید"],
  ] as const) {
    it(`${label}: فیلتر سمت سرور است نه روی آرایه`, () => {
      /*
        کوئری limit دارد؛ فیلتر محلی فقط همان ردیف‌های آخر را می‌دید و
        رکوردهای قدیمی‌ترِ داخل بازه را از قلم می‌انداخت.
      */
      const src = read(file);
      expect(src).toContain('query.gte("date", range.from)');
      expect(src).toContain('query.lte("date", range.to)');
      // بازه باید در کلید کش باشد وگرنه داده دوباره نمی‌آید
      expect(src).toContain("range.from, range.to]");
      expect(src).toContain("<DateRangeFilter");
    });
  }
});
