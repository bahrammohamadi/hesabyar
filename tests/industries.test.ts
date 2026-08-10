import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { INDUSTRIES, INDUSTRY_IDS, findIndustry, industryMeta } from "@/lib/industries";
import { BUSINESS_TYPES } from "@/lib/business-types";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*(\/\/|--).*$/gm, "");

describe("همگامی با فهرست اصناف", () => {
  it("🔴 هر صنف در business-types.ts وجود دارد", () => {
    /*
      اگر شناسه‌ای اینجا باشد که در فهرست اصلی نیست، صفحه ساخته
      می‌شود ولی برچسب و ایموجی ندارد و کاربر صفحه‌ی بی‌عنوان
      می‌بیند. همان اشتباهی که در مهاجرت ۰۰۴۰ با شناسه‌های حدسی
      ('clothing', 'restaurant') کردم.
    */
    const validIds = new Set(BUSINESS_TYPES.map((t) => t.id));
    for (const industry of INDUSTRIES) {
      expect(validIds.has(industry.id), `صنف «${industry.id}» در business-types نیست`).toBe(true);
      expect(industryMeta(industry.id)).not.toBeNull();
    }
  });

  it("صنف «سایر» صفحه‌ی اختصاصی ندارد", () => {
    // «سایر» محتوای صنفی معنادار ندارد؛ صفحه‌اش خالی می‌شد.
    expect(INDUSTRY_IDS).not.toContain("other");
  });

  it("شناسه‌ها یکتا هستند", () => {
    expect(new Set(INDUSTRY_IDS).size).toBe(INDUSTRY_IDS.length);
  });

  it("پوشش قابل قبولی از اصناف دارد", () => {
    // ۹ صنف واقعی منهای «سایر».
    expect(INDUSTRIES.length).toBeGreaterThanOrEqual(8);
  });
});

describe("🔴 صداقت محتوا — قاعده‌ی سخت این صفحات", () => {
  /*
    وسوسه‌ی صفحات صنفی این است که برای هر صنف چیزی وعده بدهیم که
    نداریم. قاعده همان قاعده‌ی صفحه‌ی امکانات است: فقط قابلیت موجود.
  */
  it("هر صنف بخش «هنوز نداریم» دارد", () => {
    for (const industry of INDUSTRIES) {
      expect(industry.notYet.length, `${industry.id} هیچ محدودیتی اعلام نکرده`).toBeGreaterThan(0);
    }
  });

  it("🔴 هر پاسخ به یک مسیر واقعیِ موجود در برنامه اشاره می‌کند", () => {
    /*
      لینک به صفحه‌ای که وجود ندارد یعنی وعده‌ی قابلیتی که نداریم.
      مسیرها با فایل‌سیستم واقعی مقایسه می‌شوند، نه با فهرست دستی.
    */
    const appDir = "app/(app)";
    const routes = new Set<string>();
    const walk = (dir: string, prefix: string) => {
      for (const entry of readdirSync(join(root, dir))) {
        const full = join(root, dir, entry);
        if (!statSync(full).isDirectory()) continue;
        // گروه‌های مسیر مثل (app) در URL نمی‌آیند
        const segment = entry.startsWith("(") ? "" : `/${entry}`;
        const next = `${prefix}${segment}`;
        if (readdirSync(full).includes("page.tsx")) routes.add(next || "/");
        walk(`${dir}/${entry}`, next);
      }
    };
    walk(appDir, "");

    for (const industry of INDUSTRIES) {
      for (const solution of industry.solutions) {
        expect(
          routes.has(solution.route),
          `صنف «${industry.id}»: مسیر ${solution.route} وجود ندارد`
        ).toBe(true);
      }
    }
  });

  it("هیچ قابلیت ناموجودی در پاسخ‌ها وعده داده نشده", () => {
    /*
      این کلمات به قابلیت‌هایی اشاره دارند که در «در حال توسعه»ی
      صفحه‌ی امکانات هستند. اگر در `answer` بیایند یعنی وعده‌ی
      نادرست داده‌ایم — ولی در `notYet` آمدنشان درست است.
    */
    const forbidden = ["سامانه‌ی مودیان", "درگاه پرداخت", "اپلیکیشن اندروید", "دوربین موبایل"];
    for (const industry of INDUSTRIES) {
      for (const solution of industry.solutions) {
        for (const word of forbidden) {
          expect(
            solution.answer.includes(word),
            `صنف «${industry.id}» قابلیت ناموجود «${word}» را وعده داده`
          ).toBe(false);
        }
      }
    }
  });

  it("هر صنف دست‌کم سه مشکل واقعی دارد", () => {
    for (const industry of INDUSTRIES) {
      expect(industry.solutions.length, industry.id).toBeGreaterThanOrEqual(3);
      for (const s of industry.solutions) {
        expect(s.pain.length, `${industry.id}: مشکل خیلی کوتاه`).toBeGreaterThan(15);
        expect(s.answer.length, `${industry.id}: پاسخ خیلی کوتاه`).toBeGreaterThan(30);
      }
    }
  });

  it("متن‌ها فارسی‌اند", () => {
    const persian = /[\u0600-\u06FF]/;
    for (const industry of INDUSTRIES) {
      expect(persian.test(industry.headline), industry.id).toBe(true);
      expect(persian.test(industry.intro), industry.id).toBe(true);
    }
  });
});

describe("جستجوی صنف", () => {
  it("شناسه‌ی معتبر پیدا می‌شود", () => {
    expect(findIndustry("apparel")?.id).toBe("apparel");
  });

  it("شناسه‌ی نامعتبر null می‌دهد", () => {
    // صفحه باید ۴۰۴ بدهد نه اینکه بترکد.
    expect(findIndustry("does-not-exist")).toBeNull();
    expect(findIndustry(null)).toBeNull();
    expect(findIndustry("")).toBeNull();
  });

  it("برچسب از business-types می‌آید نه تکرار محلی", () => {
    /*
      اگر برچسب در دو جا بود، روزی یکی عوض می‌شد و فرم معارفه با
      سایت معرفی فرق می‌کرد.
    */
    const lib = readCode("lib/industries.ts");
    expect(lib).toContain("BUSINESS_TYPES.find");
    // هیچ صنفی نباید فیلد label محلی داشته باشد.
    expect(lib).not.toMatch(/^\s*label:\s*"/m);
  });

  it("متای شناسه‌ی نامعتبر null است", () => {
    expect(industryMeta("nope")).toBeNull();
  });
});

describe("صفحات", () => {
  const listPage = readCode("app/(marketing)/industries/page.tsx");
  const detailPage = readCode("app/(marketing)/industries/[id]/page.tsx");

  it("صنف ناموجود ۴۰۴ می‌گیرد", () => {
    expect(detailPage).toContain("notFound()");
  });

  it("همه‌ی صفحات در زمان بیلد ساخته می‌شوند", () => {
    // محتوا ثابت است؛ رندر در زمان درخواست بی‌دلیل است.
    expect(detailPage).toContain("generateStaticParams");
  });

  it("متادیتای اشتراک‌گذاری دارد", () => {
    expect(detailPage).toContain("generateMetadata");
    expect(detailPage).toContain("openGraph");
  });

  it("بخش «هنوز نداریم» پیش از دکمه‌ی ثبت‌نام می‌آید", () => {
    /*
      ترتیب مهم است: کاربر باید محدودیت را *قبل* از تصمیم ببیند.
    */
    const notYetIdx = detailPage.indexOf("industry.notYet.length > 0");
    const ctaIdx = detailPage.indexOf('href="/register"');
    expect(notYetIdx).toBeGreaterThan(-1);
    expect(ctaIdx).toBeGreaterThan(-1);
    expect(notYetIdx).toBeLessThan(ctaIdx);
  });

  it("صنفی که صفحه ندارد راهنمایی می‌شود", () => {
    // «صنف من نیست» نباید بن‌بست باشد.
    expect(listPage).toContain("صنف شما در فهرست نیست؟");
  });

  it("هیچ کلاس پالت خام یا hex ندارد", () => {
    for (const [name, page] of [["list", listPage], ["detail", detailPage]] as const) {
      expect(page, `${name}: کلاس پالت خام`).not.toMatch(
        /\b(?:bg|text|border)-(?:white|black|slate|rose|emerald|sky|amber|zinc|gray|red|green|blue)(?:\/|-)/
      );
      expect(page, `${name}: رنگ hex خام`).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    }
  });
});

describe("🔴 دسترسی عمومی و SEO", () => {
  const mw = readCode("lib/supabase/middleware.ts");

  it("مسیر /industries برای کاربر خارج‌شده باز است", () => {
    /*
      همان باگی که در نوبت قبل برای /shop رخ داد: صفحه ساخته شده
      بود ولی middleware به /login می‌فرستاد. اینجا هم slug متغیر
      است پس تطبیق دقیق کافی نیست.
    */
    expect(mw).toContain("isPublicIndustry");
    expect(mw).toContain('path.startsWith("/industries/")');
  });

  it("در محاسبه‌ی isPublicSite لحاظ شده", () => {
    expect(mw).toMatch(/isPublicSite\s*=[^;]*isPublicIndustry/);
  });

  it("در نقشه‌ی سایت آمده", () => {
    // صفحاتی که «نرم‌افزار حسابداری پوشاک» را جستجو می‌کنند باید پیدا کنند.
    const sitemap = readCode("app/sitemap.ts");
    expect(sitemap).toContain("INDUSTRY_IDS");
    expect(sitemap).toContain("/industries");
  });

  it("در ناوبری سایت هست", () => {
    expect(readCode("app/(marketing)/components/SiteChrome.tsx")).toContain('"/industries"');
  });

  it("مسیرهای پنل همچنان مسدودند", () => {
    // باز کردن /industries نباید ناخواسته چیز دیگری را باز کرده باشد.
    const robots = readCode("app/robots.ts");
    for (const p of ["/settings", "/admin", "/api/"]) {
      expect(robots).toContain(`"${p}"`);
    }
  });
});
