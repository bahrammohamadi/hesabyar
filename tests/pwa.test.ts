import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  resolveInstallMode, isDismissActive, iosInstallSteps,
  INSTALL_DISMISS_KEY, DISMISS_DAYS,
} from "@/lib/pwa";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*(\/\/|--).*$/gm, "");

describe("🔴 سرویس‌ورکر — شرط لازم نصب", () => {
  /*
    مانیفست و آیکون‌ها از قبل بودند ولی هیچ سرویس‌ورکری وجود نداشت
    و هیچ‌جا ثبت نمی‌شد. کروم بدون سرویس‌ورکر دکمه‌ی «نصب» را نشان
    نمی‌دهد، پس اپ با اینکه «PWA به نظر می‌رسید» قابل نصب نبود.
  */
  it("فایل sw.js وجود دارد", () => {
    expect(existsSync(join(root, "public/sw.js"))).toBe(true);
  });

  it("در برنامه ثبت می‌شود", () => {
    const reg = readCode("components/shared/sw-register.tsx");
    expect(reg).toContain('navigator.serviceWorker.register("/sw.js")');
    expect(readCode("components/shared/app-shell.tsx")).toContain("<ServiceWorkerRegister />");
  });

  it("در حالت توسعه ثبت نمی‌شود", () => {
    // وگرنه کش، تغییرات کد را پنهان می‌کند.
    expect(readCode("components/shared/sw-register.tsx")).toContain(
      'process.env.NODE_ENV !== "production"'
    );
  });

  it("شکست ثبت چیزی را نمی‌شکند", () => {
    expect(readCode("components/shared/sw-register.tsx")).toContain(".catch(");
  });

  it("middleware مسیر sw.js را دست نمی‌زند", () => {
    // اگر middleware رویش اجرا شود، ممکن است ریدایرکت به /login بدهد.
    expect(read("middleware.ts")).toContain("sw.js");
  });
});

describe("🔴 سیاست کش — داده‌ی حسابداری هرگز کهنه نشود", () => {
  const sw = read("public/sw.js").replace(/\/\*[\s\S]*?\*\//g, "");

  it("هیچ پاسخ API کش نمی‌شود", () => {
    /*
      نمایش موجودی کهنه از خطای شبکه خطرناک‌تر است: کاربر ممکن است
      کالایی را بفروشد که ندارد. ضمناً پاسخ‌های API مخصوص کاربر
      واردشده‌اند و کش‌شان روی دستگاه مشترک نشت داده می‌سازد.
    */
    expect(sw).toContain('url.pathname.startsWith("/api/")');
    expect(sw).toMatch(/startsWith\("\/api\/"\)\)\s*return;/);
  });

  it("فقط درخواست GET پردازش می‌شود", () => {
    expect(sw).toContain('request.method !== "GET"');
  });

  it("درخواست دامنه‌ی دیگر دست‌نخورده رد می‌شود", () => {
    // Supabase و API قیمت نباید از کش بیایند.
    expect(sw).toContain("url.origin !== self.location.origin");
  });

  it("🔴 صفحات HTML کش نمی‌شوند", () => {
    /*
      اگر HTML کش شود، ممکن است نسخه‌ای بماند که به chunk حذف‌شده
      اشاره می‌کند و صفحه سفید شود. ناوبری network-only است با
      صفحه‌ی آفلاین به‌عنوان پشتیبان.
    */
    expect(sw).toContain('request.mode === "navigate"');
    expect(sw).toContain("caches.match(OFFLINE_URL)");
    // نباید پاسخ ناوبری را داخل کش بگذارد.
    expect(sw).not.toMatch(/navigate[\s\S]{0,300}cache\.put/);
  });

  it("فقط دارایی نسخه‌دار cache-first است", () => {
    // نام فایل‌های _next/static هش محتوا دارد، پس کهنگی ممکن نیست.
    expect(sw).toContain('url.pathname.startsWith("/_next/static/")');
  });

  it("کش نسخه‌های قبلی پاک می‌شود", () => {
    // وگرنه فضای مرورگر بی‌نهایت رشد می‌کند.
    expect(sw).toContain("caches.delete(key)");
    expect(sw).toContain('key.startsWith("tarazoo-")');
  });

  it("صفحه‌ی آفلاین وجود دارد و مستقل است", () => {
    expect(existsSync(join(root, "public/offline.html"))).toBe(true);
    const html = read("public/offline.html");
    // هیچ ارجاع بیرونی: دقیقاً وقتی نشان داده می‌شود که شبکه نیست.
    expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet/);
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).toContain("اتصال اینترنت قطع است");
  });
});

describe("مانیفست", () => {
  const manifest = readCode("app/manifest.webmanifest/route.ts");

  it("🔴 any و maskable با هم روی یک آیکون اعلام نمی‌شوند", () => {
    /*
      آیکون maskable باید حاشیه‌ی امن داشته باشد چون اندروید آن را
      می‌برد. اعلام یک فایل به‌عنوان هر دو یعنی یا لبه‌ها بریده
      می‌شود یا حاشیه‌ی خالی بزرگ می‌ماند. آیکون فعلی حاشیه‌ی امن
      ندارد، پس فقط any.
    */
    expect(manifest).not.toContain('"any maskable"');
  });

  it("آیکون‌های لازم اعلام شده‌اند", () => {
    for (const size of ["192x192", "512x512"]) {
      expect(manifest).toContain(size);
    }
  });

  it("فایل آیکون‌ها واقعاً وجود دارند و اندازه‌شان درست است", () => {
    /*
      اعلام آیکونی که فایلش نیست، نصب را در کروم خاموش می‌کند و
      خطایش فقط در DevTools دیده می‌شود.
    */
    const icons: [string, number][] = [
      ["public/icons/icon-192.png", 192],
      ["public/icons/icon-512.png", 512],
      ["public/apple-touch-icon.png", 180],
    ];
    for (const [path, expected] of icons) {
      expect(existsSync(join(root, path)), path).toBe(true);
      const buf = readFileSync(join(root, path));
      // ابعاد PNG در بایت‌های ۱۶ تا ۲۴ هدر IHDR است.
      expect(buf.readUInt32BE(16), `${path} عرض`).toBe(expected);
      expect(buf.readUInt32BE(20), `${path} ارتفاع`).toBe(expected);
      expect(statSync(join(root, path)).size).toBeGreaterThan(1000);
    }
  });

  it("standalone و RTL است", () => {
    expect(manifest).toContain('display: "standalone"');
    expect(manifest).toContain('dir: "rtl"');
    expect(manifest).toContain('lang: "fa"');
  });

  it("میان‌برها به مسیرهای واقعی اشاره می‌کنند", () => {
    for (const route of ["/sales", "/products", "/contacts"]) {
      expect(existsSync(join(root, `app/(app)${route}/page.tsx`)), route).toBe(true);
    }
  });
});

describe("🔴 تشخیص حالت نصب", () => {
  it("اپِ نصب‌شده دیگر پیشنهاد نصب نمی‌بیند", () => {
    /*
      مهم‌ترین حالت: کاربری که نصب کرده نباید باز هم دعوت به نصب
      ببیند. standalone بر همه‌ی شرط‌های دیگر مقدم است.
    */
    expect(
      resolveInstallMode({ standalone: true, hasPrompt: true, ios: false, inAppBrowser: false })
    ).toBe("unavailable");
    expect(
      resolveInstallMode({ standalone: true, hasPrompt: false, ios: true, inAppBrowser: false })
    ).toBe("unavailable");
  });

  it("🔴 مرورگر داخل اینستاگرام نصب را پیشنهاد نمی‌دهد", () => {
    /*
      نصب در مرورگر درون‌برنامه‌ای ممکن نیست. دکمه‌ای که کلیک شود و
      کار نکند، بدتر از نبودنش است — درسی که از دکمه‌ی ورود صوتی
      روی iOS گرفتیم.
    */
    expect(
      resolveInstallMode({ standalone: false, hasPrompt: false, ios: true, inAppBrowser: true })
    ).toBe("in-app-browser");
  });

  it("کروم دکمه‌ی واقعی می‌گیرد", () => {
    expect(
      resolveInstallMode({ standalone: false, hasPrompt: true, ios: false, inAppBrowser: false })
    ).toBe("prompt");
  });

  it("iOS راهنمای دستی می‌گیرد", () => {
    // سافاری هیچ رویداد نصبی ندارد؛ تنها کار ممکن راهنماست.
    expect(
      resolveInstallMode({ standalone: false, hasPrompt: false, ios: true, inAppBrowser: false })
    ).toBe("ios-manual");
  });

  it("مرورگر بی‌پشتیبانی چیزی نشان نمی‌دهد", () => {
    expect(
      resolveInstallMode({ standalone: false, hasPrompt: false, ios: false, inAppBrowser: false })
    ).toBe("unavailable");
  });

  it("فقط دو حالت واقعاً پیشنهاد نشان می‌دهند", () => {
    const page = readCode("components/shared/install-prompt.tsx");
    expect(page).toContain('next === "prompt" || next === "ios-manual"');
  });
});

describe("یادآوری «بعداً»", () => {
  const DAY = 24 * 60 * 60 * 1000;

  it("بدون رد کردن، پیشنهاد نشان داده می‌شود", () => {
    expect(isDismissActive(null)).toBe(false);
    expect(isDismissActive("")).toBe(false);
  });

  it("رد تازه محترم شمرده می‌شود", () => {
    const now = Date.now();
    expect(isDismissActive(String(now - 5 * DAY), now)).toBe(true);
  });

  it("پس از سی روز دوباره پرسیده می‌شود", () => {
    const now = Date.now();
    expect(isDismissActive(String(now - (DISMISS_DAYS + 1) * DAY), now)).toBe(false);
  });

  it("🔴 مقدار خراب باعث پنهان‌شدن دائمی نمی‌شود", () => {
    /*
      اگر رشته‌ی بی‌معنا را «رد شده» حساب کنیم، کاربری که
      localStorage خرابی دارد هرگز پیشنهاد نصب نمی‌بیند.
    */
    expect(isDismissActive("چیز عجیب")).toBe(false);
    expect(isDismissActive("NaN")).toBe(false);
    expect(isDismissActive("-1")).toBe(false);
    expect(isDismissActive("0")).toBe(false);
  });

  it("کلید ذخیره ثابت است", () => {
    expect(INSTALL_DISMISS_KEY).toBe("tarazoo-install-dismissed");
    expect(readCode("components/shared/install-prompt.tsx")).toContain("INSTALL_DISMISS_KEY");
  });
});

describe("راهنمای iOS", () => {
  it("🔴 می‌گوید نوار پایین، نه بالا", () => {
    /*
      از iOS 15 نوار نشانی سافاری پایین صفحه است. همان اشتباهی که
      در راهنمای میکروفون کردیم و کاربر دنبال دکمه‌ای در بالای
      صفحه می‌گشت که آنجا نبود.
    */
    const steps = iosInstallSteps().join(" ");
    expect(steps).toContain("پایین");
    expect(steps).not.toContain("بالای صفحه");
  });

  it("نام انگلیسی گزینه هم آمده", () => {
    // گوشی‌های زیادی زبانشان انگلیسی است.
    expect(iosInstallSteps().join(" ")).toContain("Add to Home Screen");
  });

  it("سه گام روشن دارد", () => {
    expect(iosInstallSteps().length).toBe(3);
  });
});

describe("رابط کاربری پیشنهاد نصب", () => {
  const page = readCode("components/shared/install-prompt.tsx");

  it("پس از نصب موفق دیگر نمی‌پرسد", () => {
    expect(page).toContain('window.addEventListener("appinstalled"');
  });

  it("با تأخیر نشان داده می‌شود نه در ثانیه‌ی اول", () => {
    // پیشنهاد نصب در لحظه‌ی ورود، مزاحمت است.
    expect(page).toContain("setTimeout");
  });

  it("listenerها پاک‌سازی می‌شوند", () => {
    expect(page).toContain("removeEventListener");
    expect(page).toContain("clearTimeout");
  });

  it("دکمه‌ی بستن برچسب دارد", () => {
    expect(page).toContain('aria-label="بستن پیشنهاد نصب"');
  });

  it("هیچ کلاس پالت خام یا hex ندارد", () => {
    expect(page).not.toMatch(
      /\b(?:bg|text|border)-(?:white|black|slate|rose|emerald|sky|amber|zinc|gray|red|green|blue)(?:\/|-)/
    );
    expect(page).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});

describe("🔴 صفحه‌ی آفلاین باید بدون ورود باز شود", () => {
  /*
    باگی که با درخواست واقعی پیدا شد: matcher در middleware
    sw.js را مستثنا کرده بود ولی offline.html را نه. نتیجه:

      GET /offline.html → 307 → /login

    یعنی سرویس‌ورکر موقع قطع شبکه صفحه‌ای را نشان می‌داد که خودش
    نیازمند شبکه و ورود بود — دقیقاً در بدترین لحظه‌ی ممکن.

    نه tsc و نه next build این را نمی‌گیرند؛ فقط یک درخواست واقعی.
  */
  it("offline.html از matcher مستثناست", () => {
    expect(read("middleware.ts")).toContain("offline.html");
  });

  it("هر دو فایل PWA مستثنا هستند", () => {
    const matcher = read("middleware.ts");
    for (const asset of ["sw.js", "offline.html", "manifest.webmanifest", "icons"]) {
      expect(matcher, asset).toContain(asset);
    }
  });
});
