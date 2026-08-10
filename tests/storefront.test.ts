import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  validateSlug, suggestSlug, normalizeInstagram, normalizeTelegram,
  normalizeWhatsapp, storefrontUrl, SLUG_PATTERN, RESERVED_SLUGS,
} from "@/lib/storefront";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*(\/\/|--).*$/gm, "");

const MIG = "supabase/migrations/0041_public_storefront.sql";
const migCode = readCode(MIG);

describe("🔴 امنیت — هیچ داده‌ی حساسی عمومی نمی‌شود", () => {
  it("هیچ policy عمومی روی جدول‌های موجود اضافه نشده", () => {
    /*
      وسوسه‌ی ساده این بود که به products/organizations یک policy
      anon بدهیم. همان جدول‌ها قیمت خرید، حاشیه‌ی سود و تلفن مالک را
      دارند؛ یک policy اشتباه همه را لو می‌داد.
    */
    expect(migCode).not.toMatch(/create policy[\s\S]{0,200}on public\.(products|organizations|product_variants)/);
    expect(migCode).not.toMatch(/to anon[\s\S]{0,40}on public\.(products|organizations)/);
  });

  it("🔴 تابع کالاها هیچ ستون حساسی برنمی‌گرداند", () => {
    /*
      اندازه‌گیری واقعی با کلید anon: کلیدهای برگشتی دقیقاً
      product_id, name, category, image_url, price, in_stock بودند.
      purchase_price و stock_qty عددی وجود نداشتند.
    */
    const idx = migCode.indexOf("function public.get_public_storefront_products");
    const signature = migCode.slice(idx, migCode.indexOf("language sql", idx));
    for (const forbidden of ["purchase_price", "cost_price", "stock_qty", "base_purchase"]) {
      expect(signature, `ستون حساس ${forbidden} در خروجی`).not.toContain(forbidden);
    }
  });

  it("موجودی به‌صورت بولین برمی‌گردد نه عدد", () => {
    // «۳ تا مانده» اطلاعات تجاری فروشگاه است؛ مشتری فقط باید بداند هست یا نه.
    expect(migCode).toContain("in_stock   boolean");
    expect(migCode).toContain("coalesce(sum(v.stock_qty), 0) > 0");
  });

  it("🔴 قیمت فقط با اجازه‌ی صریح برمی‌گردد — تصمیم در دیتابیس", () => {
    /*
      اگر فقط UI شرط می‌گذاشت، یک اشتباه در رندر قیمت را لو می‌داد.
      تابع برای فروشگاهی که show_prices=false دارد NULL می‌دهد.
      (اندازه‌گیری شد: هر سه قیمت null برگشتند.)
    */
    expect(migCode).toContain("case when sf.show_prices");
    expect(migCode).toContain("else null");
  });

  it("پیش‌فرض انتشار خاموش است", () => {
    // عمومی‌شدن ناخواسته خطایی است که پس گرفته نمی‌شود.
    expect(migCode).toContain("is_published boolean not null default false");
    expect(migCode).toContain("show_prices  boolean not null default false");
  });

  it("🔴 کسب‌وکار معلق صفحه‌ی زنده ندارد", () => {
    /*
      بدون این، تعلیق یک حساب فقط دسترسی خودش را می‌بست و ویترین
      عمومی‌اش بالا می‌ماند. (اندازه‌گیری: پس از suspend، تابع [] داد.)
    */
    const occurrences = migCode.match(/o\.approval_status = 'approved'/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
    expect((migCode.match(/o\.is_active/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("نوشتن فقط با مجوز settings.manage", () => {
    expect(migCode).toContain("public.has_permission('settings.manage')");
  });

  it("فایل بازگشت وجود دارد", () => {
    expect(existsSync(join(root, "supabase/rollbacks/0041_public_storefront.down.sql"))).toBe(true);
  });
});

describe("🔴 صفحه‌ی عمومی سمت سرور رندر می‌شود", () => {
  const page = readCode("app/shop/[slug]/page.tsx");

  it("کامپوننت کلاینت نیست", () => {
    /*
      با "use client" کلید Supabase به مرورگر می‌رفت و هر بازدیدکننده
      می‌توانست کوئری دلخواه بزند.
    */
    expect(page).not.toContain('"use client"');
  });

  it("داده از توابع محدود می‌آید نه از جدول‌ها", () => {
    expect(page).toContain('rpc("get_public_storefront"');
    expect(page).toContain('rpc("get_public_storefront_products"');
    expect(page).not.toMatch(/\.from\(["'](products|organizations|product_variants)["']\)/);
  });

  it("فروشگاه منتشرنشده ۴۰۴ می‌گیرد", () => {
    // نباید فرق «وجود ندارد» با «خصوصی است» را لو بدهیم.
    expect(page).toContain("notFound()");
  });

  it("قیمت دو لایه محافظت دارد", () => {
    expect(page).toContain("shop.show_prices && product.price != null");
  });
});

describe("اعتبارسنجی نشانی", () => {
  it("نشانی معتبر پذیرفته می‌شود", () => {
    for (const s of ["my-shop", "shop123", "a-b-c", "mazon"]) {
      expect(validateSlug(s).ok, s).toBe(true);
    }
  });

  it("🔴 حروف فارسی رد می‌شود", () => {
    // در URL به percent-encoding تبدیل می‌شوند و لینک اینستاگرام خراب می‌شود.
    const r = validateSlug("مزون");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("انگلیسی");
  });

  it("🔴 نشانی خطرناک یا بدشکل رد می‌شود", () => {
    for (const bad of ["../admin", "a b", "-lead", "trail-", "ab", "a/b", "a.b", "a_b", "a%2f"]) {
      expect(validateSlug(bad).ok, bad).toBe(false);
    }
  });

  it("حروف بزرگ به کوچک تبدیل می‌شود، نه رد", () => {
    /*
      نسخه‌ی اول تست انتظار داشت «UPPER» رد شود. ولی رفتار درست
      پذیرفتنِ آن و کوچک‌کردن است — کاربری که ناخواسته Caps Lock
      داشته نباید خطا بگیرد.

      شرط لازم: روت API هم پیش از ذخیره کوچک کند، وگرنه قید
      دیتابیس رد می‌کند. همان‌جا `.toLowerCase()` هست و تست زیر
      تضمینش می‌کند.
    */
    expect(validateSlug("UPPER").ok).toBe(true);
    expect(readCode("app/api/storefront/route.ts")).toContain(
      'String(body.slug ?? "").trim().toLowerCase()'
    );
  });

  it("نشانی رزروشده رد می‌شود", () => {
    for (const s of ["admin", "api", "settings", "login"]) {
      expect(validateSlug(s).ok, s).toBe(false);
    }
    expect(RESERVED_SLUGS.size).toBeGreaterThan(10);
  });

  it("طول بیش از حد رد می‌شود", () => {
    expect(validateSlug("a".repeat(41)).ok).toBe(false);
    expect(validateSlug("a".repeat(40)).ok).toBe(true);
  });

  it("ورودی غیر رشته‌ای رد می‌شود", () => {
    expect(validateSlug(null).ok).toBe(false);
    expect(validateSlug(123).ok).toBe(false);
  });

  it("🔴 الگوی TypeScript با قید دیتابیس یکی است", () => {
    /*
      اگر از هم جدا بیفتند، فرم چیزی را می‌پذیرد که دیتابیس رد
      می‌کند و کاربر خطای خام ۲۳۵۱۴ می‌بیند.
    */
    const dbPattern = migCode.match(/check \(slug ~ '([^']+)'\)/)?.[1];
    expect(dbPattern).toBeTruthy();
    expect(SLUG_PATTERN.source).toBe(dbPattern);
  });
});

describe("پیشنهاد نشانی", () => {
  it("نام فارسی پیشنهادی نمی‌دهد", () => {
    // پیشنهاد بی‌ربط بدتر از نبودِ پیشنهاد است.
    expect(suggestSlug("مزون پوشاک")).toBeNull();
  });

  it("نام لاتین به slug تبدیل می‌شود", () => {
    expect(suggestSlug("My Shop")).toBe("my-shop");
    expect(suggestSlug("  Cool   Store  ")).toBe("cool-store");
  });

  it("ورودی تهی امن است", () => {
    expect(suggestSlug(null)).toBeNull();
    expect(suggestSlug("")).toBeNull();
  });
});

describe("نرمال‌سازی شبکه‌های اجتماعی", () => {
  it("اینستاگرام از هر قالبی به نام خالص می‌رسد", () => {
    for (const input of [
      "@myshop", "myshop", "instagram.com/myshop",
      "https://instagram.com/myshop", "https://www.instagram.com/myshop/?hl=fa",
    ]) {
      expect(normalizeInstagram(input), input).toBe("myshop");
    }
  });

  it("تلگرام هم همین‌طور", () => {
    for (const input of ["@myshop", "t.me/myshop", "https://t.me/myshop"]) {
      expect(normalizeTelegram(input), input).toBe("myshop");
    }
  });

  it("🔴 واتس‌اپ کد کشور می‌گیرد", () => {
    /*
      wa.me بدون کد کشور برای کاربر خارج از ایران کار نمی‌کند.
    */
    expect(normalizeWhatsapp("09121234567")).toBe("989121234567");
    expect(normalizeWhatsapp("+98 912 123 4567")).toBe("989121234567");
    expect(normalizeWhatsapp("0912-123-4567")).toBe("989121234567");
  });

  it("ورودی تهی یا بی‌معنا null می‌شود", () => {
    for (const fn of [normalizeInstagram, normalizeTelegram, normalizeWhatsapp]) {
      expect(fn(null)).toBeNull();
      expect(fn("")).toBeNull();
      expect(fn("   ")).toBeNull();
    }
  });

  it("نشانی صفحه درست ساخته می‌شود", () => {
    expect(storefrontUrl("my-shop", "https://example.com")).toBe("https://example.com/shop/my-shop");
    // اسلش انتهایی نباید دوتایی شود.
    expect(storefrontUrl("my-shop", "https://example.com/")).toBe("https://example.com/shop/my-shop");
  });
});

describe("روت API", () => {
  const route = readCode("app/api/storefront/route.ts");

  it("مجوز settings.manage می‌خواهد", () => {
    expect((route.match(/requireMember\(null, "settings\.manage"\)/g) ?? []).length).toBe(2);
  });

  it("نشانی تکراری پیام فارسی می‌دهد نه خطای خام", () => {
    expect(route).toContain("is_storefront_slug_available");
    expect(route).toContain("قبلاً توسط کسب‌وکار دیگری گرفته شده");
  });

  it("طول فیلدها محدود می‌شود", () => {
    // جلوگیری از پرکردن جدول با متن چندمگابایتی.
    expect(route).toContain("const LIMITS");
    expect(route).toContain("about: 2000");
  });

  it("ورودی شبکه‌های اجتماعی نرمال می‌شود", () => {
    expect(route).toContain("normalizeInstagram");
    expect(route).toContain("normalizeWhatsapp");
  });

  it("🔴 فقط export های مجاز Next دارد", () => {
    const ALLOWED = new Set([
      "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
      "dynamic", "revalidate", "runtime", "maxDuration",
      "preferredRegion", "fetchCache", "dynamicParams",
    ]);
    for (const m of route.matchAll(/^export\s+(?:async\s+)?(?:function|const)\s+(\w+)/gm)) {
      expect(ALLOWED.has(m[1]), `export غیرمجاز «${m[1]}»`).toBe(true);
    }
  });
});

describe("رابط کاربری تنظیمات", () => {
  const page = readCode("app/(app)/settings/storefront/page.tsx");

  it("در سایدبار و نوار تب هست", () => {
    expect(readCode("components/shared/sidebar.tsx")).toContain('"/settings/storefront"');
    expect(readCode("app/(app)/settings/layout.tsx")).toContain('"/settings/storefront"');
    expect(readCode("app/(app)/settings/page.tsx")).toContain('"/settings/storefront"');
  });

  it("وضعیت انتشار صریح نمایش داده می‌شود", () => {
    expect(page).toContain("منتشر نشده است");
    expect(page).toContain('aria-pressed={form.is_published}');
  });

  it("🔴 به کاربر گفته می‌شود چه چیزی عمومی نمی‌شود", () => {
    // صداقت درباره‌ی مرز داده مهم‌تر از تبلیغ قابلیت است.
    expect(page).toContain("قیمت خرید و تعداد دقیق موجودی هرگز عمومی نمی‌شود");
  });

  it("دکمه‌ی ذخیره با نشانی نامعتبر غیرفعال است", () => {
    expect(page).toContain("disabled={!canSave}");
    expect(page).toContain("validateSlug");
  });

  it("هیچ کلاس پالت خام یا hex ندارد", () => {
    expect(page).not.toMatch(
      /\b(?:bg|text|border)-(?:white|black|slate|rose|emerald|sky|amber|zinc|gray|red|green|blue)(?:\/|-)/
    );
    expect(page).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});

describe("SEO", () => {
  it("مسیر فروشگاه برای خزنده باز است", () => {
    // کل هدف این صفحه دیده‌شدن است.
    const robots = readCode("app/robots.ts");
    expect(robots).not.toMatch(/disallow[\s\S]{0,300}"\/shop/);
  });

  it("تنظیمات فروشگاه ایندکس نمی‌شود", () => {
    // /settings در disallow است، پس زیرمسیرش هم پوشش دارد.
    expect(readCode("app/robots.ts")).toContain('"/settings"');
  });

  it("صفحه متادیتای اشتراک‌گذاری دارد", () => {
    const page = readCode("app/shop/[slug]/page.tsx");
    expect(page).toContain("generateMetadata");
    expect(page).toContain("openGraph");
  });
});

describe("🔴 دسترسی عمومی در middleware", () => {
  /*
    باگی که فقط با بازدید واقعی به‌عنوان کاربر خارج‌شده پیدا شد:
    صفحه ساخته شده بود، تابع دیتابیس درست جواب می‌داد و ۴۱ تست سبز
    بودند — ولی middleware بازدیدکننده‌ی ناشناس را به /login
    می‌فرستاد. یعنی صفحه‌ی «عمومی» عملاً خصوصی بود.

    نه tsc و نه next build چنین چیزی را نمی‌گیرند، چون هیچ‌کدام
    مسیر واقعی درخواست را اجرا نمی‌کنند.
  */
  const mw = readCode("lib/supabase/middleware.ts");

  it("مسیر /shop برای کاربر خارج‌شده باز است", () => {
    expect(mw).toContain('path.startsWith("/shop/")');
    expect(mw).toContain("isPublicStorefront");
  });

  it("در محاسبه‌ی isPublicSite لحاظ شده", () => {
    expect(mw).toMatch(/isPublicSite\s*=\s*PUBLIC_SITE_PATHS\.has\(path\)\s*\|\|\s*isPublicStorefront/);
  });

  it("بقیه‌ی مسیرها همچنان محافظت‌شده‌اند", () => {
    // فهرست ثابت باید تطبیق دقیق بماند تا /features-secret عمومی نشود.
    expect(mw).toContain("PUBLIC_SITE_PATHS.has(path)");
    expect(mw).not.toContain('path.startsWith("/settings")');
  });
});
