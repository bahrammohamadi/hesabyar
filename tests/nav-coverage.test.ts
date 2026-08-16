import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

/**
 * 🔴 این فایل از تکرار «صفحه‌ی یتیم» جلوگیری می‌کند.
 *
 * حسابرسی مرداد ۱۴۰۵ نشان داد **۲۰ صفحه** ساخته شده‌اند، کار می‌کنند،
 * ولی هیچ لینکی در منو ندارند — کاربر فقط با تایپ دستی نشانی پیدایشان
 * می‌کرد. از جمله `/settings/general` که فرم هویت برند و اعلان دستگاه
 * در آن است.
 *
 * صفحه‌ای که ساخته شود و در دسترس نباشد، عملاً وجود ندارد.
 */

/** همه‌ی نشانی‌های لینک‌شده در سایدبار. */
function navHrefs(): Set<string> {
  const src = read("components/shared/sidebar.tsx");
  return new Set([...src.matchAll(/href:\s*"(\/[^"]*)"/g)].map((m) => m[1]));
}

/** همه‌ی صفحات واقعی زیر app/(app) — بدون مسیرهای پویا. */
function appPages(): string[] {
  const out: string[] = [];
  const walk = (rel: string, url: string) => {
    for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
      if (e.isDirectory()) {
        // مسیر پویا مثل [id] لینک مستقیم ندارد.
        if (e.name.startsWith("[")) continue;
        walk(`${rel}/${e.name}`, `${url}/${e.name}`);
      } else if (e.name === "page.tsx") {
        out.push(url || "/");
      }
    }
  };
  walk("app/(app)", "");
  return out;
}

/**
 * صفحاتی که عمداً در منو نیستند و دلیلش مستند است.
 *
 * ⚠️ افزودن به این فهرست باید سخت باشد. هر ورودی نیاز به دلیل دارد،
 * وگرنه دوباره به همان ۲۰ صفحه‌ی گم‌شده برمی‌گردیم.
 */
const INTENTIONAL_ORPHANS: Record<string, string> = {
  "/dev/ui": "صفحه‌ی توسعه‌دهنده، برای کاربر نهایی نیست",
  "/contacts/new-customer": "مسیر مستقیم ساخت؛ از دکمه‌ی «مشتری جدید» باز می‌شود",
  "/contacts/new-supplier": "مسیر مستقیم ساخت؛ از دکمه باز می‌شود",
  "/settings/import/guide": "زیرصفحه‌ی راهنما؛ از خود صفحه‌ی ورود اکسل لینک دارد",
  "/inventory": "تغییرمسیر به /inventory/movements",
  "/reports": "میزبان تب‌هاست؛ از /reports/overview-v2 در منوست",
  "/reports/sales": "تب داخل صفحه‌ی گزارش‌ها",
  "/reports/products": "تب داخل صفحه‌ی گزارش‌ها",
  "/reports/profit": "تب داخل صفحه‌ی گزارش‌ها",
  "/reports/financial": "تب داخل صفحه‌ی گزارش‌ها",
  "/reports/contacts": "تب داخل صفحه‌ی گزارش‌ها",
  "/crm/loyalty": "تغییرمسیر به /loyalty",
  "/loyalty/wallet": "زیربخش امتیاز و کیف‌پول",
  "/loyalty/settings": "زیربخش تنظیمات باشگاه",
};

describe("🔴 هیچ صفحه‌ی یتیمی نماند", () => {
  const hrefs = navHrefs();
  const pages = appPages();

  it("هر صفحه یا در منوست یا دلیل مستند دارد", () => {
    const orphans = pages.filter(
      (p) => !hrefs.has(p) && !(p in INTENTIONAL_ORPHANS) && !p.startsWith("/admin")
    );
    expect(
      orphans,
      `صفحات بدون لینک و بدون دلیل:\n${orphans.join("\n")}`
    ).toEqual([]);
  });

  it("🔴 صفحه‌ی تنظیمات کسب‌وکار در منوست", () => {
    /*
      این همان صفحه‌ای است که فرم هویت برند، آپلود لوگو و فعال‌سازی
      اعلان دستگاه در آن ساخته شد — و ماه‌ها هیچ لینکی نداشت.
    */
    expect(hrefs.has("/settings/general")).toBe(true);
  });

  it("صفحات CRM در منو هستند", () => {
    for (const p of ["/crm", "/crm/interactions", "/crm/rfm", "/crm/automation"]) {
      expect(hrefs.has(p), p).toBe(true);
    }
  });

  it("هر لینک منو به صفحه‌ی واقعی می‌رسد", () => {
    /*
      عکس ادعای بالا: لینکی که صفحه ندارد، خطای ۴۰۴ می‌دهد.
      مسیرهای admin و بیرونی مستثنا هستند.
    */
    const known = new Set(pages);
    const broken = [...hrefs].filter(
      (h) => !known.has(h) && !h.startsWith("/admin") && !h.startsWith("http")
    );
    expect(broken, `لینک‌های شکسته: ${broken.join(", ")}`).toEqual([]);
  });
});

describe("نظم منو", () => {
  const src = read("components/shared/sidebar.tsx");

  it("هیچ گروهی بیش از ده آیتم ندارد", () => {
    /*
      گروه با پانزده آیتم عملاً همان فهرست بلند بی‌نظم است. ده مرز
      عملی است: بیشتر از آن روی موبایل نیاز به اسکرول داخل گروه دارد.
    */
    const groups = [...src.matchAll(/label: "([^"]+)",\s*\n\s*icon: \w+,\s*\n\s*children: \[([\s\S]*?)\n\s*\],/g)];
    expect(groups.length).toBeGreaterThan(0);
    for (const [, name, body] of groups) {
      const count = (body.match(/href:/g) ?? []).length;
      expect(count, `گروه «${name}» ${count} آیتم دارد`).toBeLessThanOrEqual(10);
    }
  });

  it("هیچ برچسبی تکراری نیست", () => {
    // دو «نمای کلی» در دو گروه، کاربر را سردرگم می‌کند.
    const labels = [...src.matchAll(/href: "\/[^"]*", label: "([^"]+)"/g)].map((m) => m[1]);
    const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
    expect([...new Set(dupes)], `برچسب تکراری: ${dupes.join(", ")}`).toEqual([]);
  });

  it("بستانکاران از بدهکاران جدا شده", () => {
    // «بدهکاران / بستانکاران» یک لینک برای دو مفهوم متضاد بود.
    expect(src).toContain('label: "بدهکاران"');
    expect(src).toContain('label: "بستانکاران"');
  });
});
