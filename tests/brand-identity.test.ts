import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  normalizeBrand,
  logoPath,
  extensionOf,
  validateLogoFile,
  brandCompleteness,
  instagramUrl,
  safeFileName,
  EMPTY_BRAND,
  LOGO_BUCKET,
  LOGO_MAX_BYTES,
  toWhatsAppNumber,
} from "@/lib/brand-identity";

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

describe("🔴 سربرگ فاکتور باید برند کاربر باشد نه ترازو", () => {
  /*
    باگ واقعی: صفحه‌ی فاکتور `<img src="/logo.png" alt={BRAND_NAME} />`
    و `<h1>{BRAND_NAME}</h1>` داشت. مشتریِ «مزون پوشاک» فاکتوری
    می‌گرفت که بالایش نوشته بود «ترازو».
  */
  const page = readCode("app/(app)/sales/[id]/page.tsx");

  it("لوگوی ثابت /logo.png دیگر در فاکتور نیست", () => {
    expect(page).not.toContain('src="/logo.png"');
  });

  it("نام برند از هویت سازمان می‌آید نه BRAND_NAME", () => {
    expect(page).toContain("brand.logo_url");
    expect(page).toContain("brandName");
    // BRAND_NAME نباید در سربرگ فاکتور استفاده شود
    expect(page).not.toContain("<h1 className=\"text-xl font-bold text-primary\">{BRAND_NAME}</h1>");
  });

  it("هویت برند از RPC خوانده می‌شود", () => {
    expect(page).toContain('supabase.rpc("get_brand_identity"');
    expect(page).toContain("normalizeBrand(data)");
  });

  it("🔴 اگر لوگو نباشد جای خالی نمی‌ماند", () => {
    // fallback با دو حرف اول نام — کادر خالی سند را ناقص نشان می‌دهد.
    expect(page).toContain("brandName.slice(0, 2)");
  });

  it("اطلاعات تماس در پای فاکتور چاپ می‌شود", () => {
    for (const f of ["brand.phone", "brand.address", "brand.national_id", "brand.economic_code"]) {
      expect(page, f).toContain(f);
    }
  });

  it("یادداشت پای فاکتور فقط وقتی پر است چاپ می‌شود", () => {
    expect(page).toContain("brand.invoice_note &&");
  });

  it("🔴 مبلغ و تاریخ پرداخت در یک رشته با جداکننده نیستند", () => {
    /*
      باگ bidi که از روی اسکرین‌شات پیدا شد: «مبلغ • تاریخ» در متن
      راست‌به‌چپ بازچینش می‌شد و «۱۴۰۵/۰۵/۲۲ ۰ ۸۷۸,۰۰۰» دیده می‌شد.
      در DOM متن درست بود، پس تست رشته‌ای روی محتوا نمی‌گرفتش.
      سومین بار این خانواده باگ است.
    */
    expect(page).not.toMatch(/\{formatToman\(payment\.amount, false\)\} • \{toJalali/);
  });
});

describe("نرمال‌سازی هویت برند", () => {
  it("ورودی خراب صفحه را نمی‌شکند", () => {
    expect(normalizeBrand(null)).toEqual(EMPTY_BRAND);
    expect(normalizeBrand(undefined)).toEqual(EMPTY_BRAND);
    expect(normalizeBrand("خطا")).toEqual(EMPTY_BRAND);
    expect(normalizeBrand([])).toEqual(EMPTY_BRAND);
  });

  it("رشته‌ی خالی و فاصله null می‌شود", () => {
    // «   » نباید به‌عنوان نام برند روی فاکتور چاپ شود.
    const out = normalizeBrand({ display_name: "   ", phone: "" });
    expect(out.display_name).toBeNull();
    expect(out.phone).toBeNull();
  });

  it("مقدار غیر رشته‌ای نادیده گرفته می‌شود", () => {
    const out = normalizeBrand({ display_name: 42, logo_url: { a: 1 } });
    expect(out.display_name).toBeNull();
    expect(out.logo_url).toBeNull();
  });

  it("مقدار درست با trim برمی‌گردد", () => {
    const out = normalizeBrand({ display_name: "  مزون پوشاک  " });
    expect(out.display_name).toBe("مزون پوشاک");
  });
});

describe("🔴 مسیر لوگو باید با شناسه‌ی سازمان شروع شود", () => {
  /*
    سیاست RLS سطل با `(storage.foldername(name))[1]` می‌سنجد که پوشه‌ی
    اول برابر org کاربر باشد. اگر ساختار عوض شود، یا آپلود رد می‌شود
    یا کاربر می‌تواند روی فایل سازمان دیگری بنویسد.
  */
  const ORG = "ec60535d-6372-428a-92fe-06f1eb63f4b7";

  it("پوشه‌ی اول، شناسه‌ی سازمان است", () => {
    const p = logoPath(ORG, "logo.png", 1000);
    expect(p.split("/")[0]).toBe(ORG);
  });

  it("مهر زمانی دارد تا کش مرورگر لوگوی قدیمی را نشان ندهد", () => {
    expect(logoPath(ORG, "a.png", 111)).not.toBe(logoPath(ORG, "a.png", 222));
  });

  it("پسوند از نام فایل می‌آید و محدود است", () => {
    expect(extensionOf("logo.PNG")).toBe("png");
    expect(extensionOf("a.jpeg")).toBe("jpeg");
    expect(extensionOf("a.svg")).toBe("svg");
    // پسوند ناشناخته یا خطرناک → png
    expect(extensionOf("shell.php")).toBe("png");
    expect(extensionOf("noext")).toBe("png");
  });
});

describe("اعتبارسنجی فایل لوگو", () => {
  it("فرمت غیرمجاز رد می‌شود", () => {
    expect(validateLogoFile({ size: 100, type: "application/pdf" })).not.toBeNull();
    expect(validateLogoFile({ size: 100, type: "text/html" })).not.toBeNull();
  });

  it("فرمت‌های مجاز پذیرفته می‌شوند", () => {
    for (const t of ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]) {
      expect(validateLogoFile({ size: 1000, type: t })).toBeNull();
    }
  });

  it("🔴 سقف حجم رعایت می‌شود", () => {
    // هم‌تراز با file_size_limit سطل؛ اگر واگرا شوند، آپلود سمت سرور رد می‌شود
    // ولی کاربر پیام مبهم می‌گیرد.
    expect(LOGO_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(validateLogoFile({ size: LOGO_MAX_BYTES + 1, type: "image/png" })).not.toBeNull();
    expect(validateLogoFile({ size: LOGO_MAX_BYTES, type: "image/png" })).toBeNull();
  });

  it("فایل خالی رد می‌شود", () => {
    expect(validateLogoFile({ size: 0, type: "image/png" })).not.toBeNull();
  });
});

describe("شماره‌ی واتساپ", () => {
  it("۰۹۱۲... به ۹۸۹۱۲... تبدیل می‌شود", () => {
    expect(toWhatsAppNumber("09123456789")).toBe("989123456789");
  });

  it("🔴 ارقام فارسی هم کار می‌کنند", () => {
    /*
      شماره‌ها در دیتابیس گاهی فارسی ذخیره شده‌اند. بدون toEnDigits،
      replace(/\D/g) همه‌ی ارقام را حذف می‌کرد و لینک واتساپ خالی
      می‌ساخت — دکمه‌ای که کار نکند.
    */
    expect(toWhatsAppNumber("۰۹۱۲۳۴۵۶۷۸۹")).toBe("989123456789");
  });

  it("جداکننده‌ها نادیده گرفته می‌شوند", () => {
    expect(toWhatsAppNumber("0912-345-6789")).toBe("989123456789");
    expect(toWhatsAppNumber("+98 912 345 6789")).toBe("989123456789");
  });

  it("ورودی خالی null می‌دهد", () => {
    expect(toWhatsAppNumber(null)).toBeNull();
    expect(toWhatsAppNumber("")).toBeNull();
    expect(toWhatsAppNumber("abc")).toBeNull();
  });
});

describe("نشانی اینستاگرام", () => {
  it("هر سه شکل ورودی به یک لینک می‌رسند", () => {
    const want = "https://instagram.com/myshop";
    expect(instagramUrl("myshop")).toBe(want);
    expect(instagramUrl("@myshop")).toBe(want);
    expect(instagramUrl("instagram.com/myshop")).toBe(want);
  });

  it("نشانی کامل دست‌نخورده می‌ماند", () => {
    expect(instagramUrl("https://instagram.com/x")).toBe("https://instagram.com/x");
  });

  it("خالی null می‌دهد", () => {
    expect(instagramUrl(null)).toBeNull();
    expect(instagramUrl("  ")).toBeNull();
    expect(instagramUrl("@")).toBeNull();
  });
});

describe("نام فایل امن", () => {
  it("🔴 نویسه‌های شکننده‌ی سیستم‌فایل حذف می‌شوند", () => {
    // «فاکتور F-001/2» نام فایل نامعتبر می‌ساخت و دانلود شکست می‌خورد.
    expect(safeFileName("a/b:c*d?e")).not.toMatch(/[\\/:*?"<>|]/);
  });

  it("فاصله به خط تیره تبدیل می‌شود", () => {
    expect(safeFileName("مزون پوشاک F-001")).toBe("مزون-پوشاک-F-001");
  });

  it("ورودی خالی به fallback می‌رسد", () => {
    expect(safeFileName("   ")).toBe("invoice");
    expect(safeFileName("///")).toBe("invoice");
  });
});

describe("کامل بودن اطلاعات برند", () => {
  it("خالی یعنی چهار مورد ناقص", () => {
    const c = brandCompleteness(EMPTY_BRAND);
    expect(c.filled).toBe(0);
    expect(c.total).toBe(4);
    expect(c.missing).toHaveLength(4);
  });

  it("پر شدن هر مورد شمارنده را بالا می‌برد", () => {
    const c = brandCompleteness({ ...EMPTY_BRAND, display_name: "الف", phone: "۱" });
    expect(c.filled).toBe(2);
    expect(c.missing).toEqual(["لوگو", "آدرس"]);
  });
});

describe("🔴 مهاجرت — امنیت سطل و توابع", () => {
  const sql = readCode("supabase/migrations/0044_brand_identity.sql");

  it("سطل با نام درست و محدودیت حجم ساخته می‌شود", () => {
    expect(sql).toContain("'brand-logos'");
    expect(LOGO_BUCKET).toBe("brand-logos");
    expect(sql).toContain("2097152");
  });

  it("🔴 آپلود فقط برای عضو همان سازمان مجاز است", () => {
    /*
      بدون این، هر کاربر واردشده‌ای می‌توانست لوگوی هر کسب‌وکار
      دیگری را بازنویسی کند — همان دسته اشتباه policy با
      `using (true)` که در مهاجرت ۰۰۴۰ گرفتیم.
    */
    const guards = sql.match(/storage\.foldername\(name\)\)\[1\] in \(\s*select org_id::text from public\.memberships where user_id = auth\.uid\(\)/g) ?? [];
    // insert + update + delete
    expect(guards.length).toBe(3);
  });

  it("خواندن عمومی است چون لوگو باید در فاکتور چاپی دیده شود", () => {
    expect(sql).toMatch(/brand_logos_public_read[\s\S]*?for select/);
  });

  it("توابع عضویت سازمان را چک می‌کنند", () => {
    const checks = sql.match(/user_org_ids\(\)/g) ?? [];
    expect(checks.length).toBeGreaterThanOrEqual(2);
  });

  it("ذخیره نیازمند مجوز تنظیمات است", () => {
    expect(sql).toContain("has_permission('settings.manage')");
  });

  it("🔴 فقط کلیدهای شناخته‌شده ذخیره می‌شوند", () => {
    // بدون allowlist، کلاینت می‌توانست هر داده‌ی حجیمی در settings بریزد.
    expect(sql).toContain("foreach k in array array[");
    expect(sql).toContain("left(v,");
  });

  it("دسترسی از anon گرفته شده", () => {
    expect(sql).toContain("from public, anon");
    expect(sql).toContain("to authenticated");
  });

  it("نام هرگز خالی برنمی‌گردد", () => {
    // سربرگ فاکتور بدون نام، سند بی‌هویت است.
    expect(sql).toContain("coalesce(nullif(trim(v_brand->>'display_name'), ''), v_org.name)");
  });
});

describe("فرم تنظیمات برند", () => {
  const form = readCode("components/shared/brand-identity-form.tsx");

  it("در صفحه‌ی تنظیمات عمومی رندر می‌شود", () => {
    expect(readCode("app/(app)/settings/general/page.tsx")).toContain("<BrandIdentityForm />");
  });

  it("مسیر آپلود از logoPath می‌آید نه دستی", () => {
    expect(form).toContain("logoPath(orgId, file.name)");
  });

  it("پیش از آپلود اعتبارسنجی می‌شود", () => {
    expect(form).toContain("validateLogoFile(file)");
  });

  it("هیچ کلاس پالت خام یا hex ندارد", () => {
    expect(form).not.toMatch(
      /\b(?:bg|text|border)-(?:white|black|slate|rose|emerald|sky|amber|zinc|gray|red|green|blue)(?:\/|-)/
    );
    expect(form).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});

describe("ارسال فاکتور", () => {
  const share = readCode("components/shared/invoice-share.tsx");
  const page = readCode("app/(app)/sales/[id]/page.tsx");

  it("در صفحه‌ی فاکتور رندر می‌شود", () => {
    expect(page).toContain("<InvoiceShare");
    expect(page).toContain('targetId="invoice-print"');
  });

  it("هر سه راه ارسال هست: تصویر، واتساپ، لینک", () => {
    expect(share).toContain("navigator.share");
    expect(share).toContain("wa.me");
    expect(share).toContain("clipboard.writeText");
  });

  it("🔴 canShare پیش از share چک می‌شود", () => {
    /*
      روی دسکتاپ `navigator.share` با فایل استثنا می‌دهد و کاربر فکر
      می‌کند برنامه خراب است. باید به دانلود برگردد.
    */
    expect(share).toContain("navigator.canShare");
    const canAt = share.indexOf("navigator.canShare");
    const shareAt = share.indexOf("await navigator.share");
    expect(canAt).toBeLessThan(shareAt);
  });

  it("بستن پنجره‌ی اشتراک خطا حساب نمی‌شود", () => {
    expect(share).toContain('"AbortError"');
  });

  it("🔴 دکمه‌های no-print در تصویر نمی‌آیند", () => {
    // تصویری که دست مشتری می‌رود نباید دکمه‌ی «ابطال» داشته باشد.
    expect(share).toContain('classList?.contains("no-print")');
  });

  it("پس‌زمینه‌ی صریح دارد", () => {
    // بدون آن تصویر شفاف می‌شود و در واتساپ سیاه دیده می‌شود.
    expect(share).toContain('backgroundColor: "#ffffff"');
  });

  it("کتابخانه‌ی تصویر پویا وارد می‌شود", () => {
    // نباید به باندل هر صفحه‌ای که این کامپوننت را دارد اضافه شود.
    expect(share).toContain('await import("html-to-image")');
  });
});
