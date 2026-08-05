import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isIOS, isInAppBrowser, permissionHelp } from "@/lib/utils/platform";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
/** کد بدون توضیحات — چند ادعا قبلاً روی توضیح فارسی گیر می‌کردند. */
const readCode = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** جایگزینی موقت userAgent. */
function withUA(ua: string, hasTouch = false, fn: () => void) {
  const g = globalThis as Record<string, unknown>;
  const prevNav = g.navigator;
  const prevDoc = g.document;
  g.navigator = { userAgent: ua } as Navigator;
  g.document = hasTouch ? ({ ontouchend: null } as unknown as Document) : ({} as Document);
  try {
    fn();
  } finally {
    g.navigator = prevNav;
    g.document = prevDoc;
  }
}

afterEach(() => vi.restoreAllMocks());

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36";
const INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Instagram 302.0.0.23.113";
const TELEGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 Telegram-iOS/10.2";

describe("تشخیص iOS", () => {
  it("آیفون شناسایی می‌شود", () => {
    withUA(IPHONE, false, () => expect(isIOS()).toBe(true));
  });

  it("🔴 آیپد که خودش را Macintosh معرفی می‌کند هم شناسایی می‌شود", () => {
    /*
      iPadOS 13 به بعد عمداً userAgent دسکتاپ می‌فرستد تا سایت‌ها
      نسخه‌ی کامل بدهند. بدون بررسی صفحه‌ی لمسی، آیپد از قلم می‌افتاد و
      همان باگ مجوز را می‌گرفت.
    */
    withUA(IPAD_DESKTOP, true, () => expect(isIOS()).toBe(true));
  });

  it("مک واقعی iOS شمرده نمی‌شود", () => {
    // مک‌بوک `ontouchend` ندارد — همین تمایز را ممکن می‌کند.
    withUA(MAC, false, () => expect(isIOS()).toBe(false));
  });

  it("اندروید iOS نیست", () => {
    withUA(ANDROID, false, () => expect(isIOS()).toBe(false));
  });

  it("بدون navigator خطا نمی‌دهد (رندر سمت سرور)", () => {
    const g = globalThis as Record<string, unknown>;
    const prev = g.navigator;
    delete g.navigator;
    try {
      expect(isIOS()).toBe(false);
    } finally {
      g.navigator = prev;
    }
  });
});

describe("🔴 تشخیص مرورگر درون‌برنامه‌ای", () => {
  /*
    برای کاربران ایرانی حیاتی است: بیشترشان لینک را از اینستاگرام یا
    تلگرام باز می‌کنند. در WKWebView، `webkitSpeechRecognition` وجود
    دارد پس هر بررسی قابلیتی می‌گوید «پشتیبانی می‌شود»، ولی start()
    بی‌صدا شکست می‌خورد.
  */
  it.each([
    ["اینستاگرام", INSTAGRAM],
    ["تلگرام", TELEGRAM],
  ])("%s شناسایی می‌شود", (_label, ua) => {
    withUA(ua, true, () => expect(isInAppBrowser()).toBe(true));
  });

  it("سافاری معمولی درون‌برنامه‌ای نیست", () => {
    withUA(IPHONE, true, () => expect(isInAppBrowser()).toBe(false));
  });

  it("کروم اندروید درون‌برنامه‌ای نیست", () => {
    withUA(ANDROID, false, () => expect(isInAppBrowser()).toBe(false));
  });
});

describe("🔴 راهنمای مجوز متناسب با دستگاه", () => {
  it("در آیفون از «aA» می‌گوید، نه از آیکون قفل", () => {
    /*
      باگ اصلی که کاربر گزارش کرد: پیام می‌گفت «روی آیکون قفل کنار
      نشانی سایت بزنید». در سافاری آیفون چنین آیکونی **وجود ندارد**؛
      کاربر دنبال چیزی می‌گشت که نبود و هیچ کاری از دستش برنمی‌آمد.
    */
    withUA(IPHONE, true, () => {
      const h = permissionHelp("microphone");
      expect(h.variant).toBe("ios");
      expect(h.steps.join(" ")).toContain("aA");
      expect(h.steps.join(" ")).not.toContain("قفل");
    });
  });

  it("در دسکتاپ همان راهنمای قفل می‌ماند", () => {
    withUA(MAC, false, () => {
      const h = permissionHelp("microphone");
      expect(h.variant).toBe("default");
      expect(h.steps.join(" ")).toContain("قفل");
    });
  });

  it("در مرورگر درون‌برنامه‌ای، «باز کردن در سافاری» پیشنهاد می‌شود", () => {
    // هیچ تنظیمی آنجا کمک نمی‌کند؛ تنها راه خروج از آن مرورگر است.
    withUA(INSTAGRAM, true, () => {
      const h = permissionHelp("camera");
      expect(h.variant).toBe("in-app");
      expect(h.steps.join(" ")).toContain("Safari");
    });
  });

  it("راهنمای دوربین و میکروفون متن درست دارند", () => {
    withUA(IPHONE, true, () => {
      expect(permissionHelp("camera").steps.join(" ")).toContain("Camera");
      expect(permissionHelp("microphone").steps.join(" ")).toContain("Microphone");
    });
  });

  it("هر حالت حداقل سه گام دارد", () => {
    for (const [ua, touch] of [[IPHONE, true], [MAC, false], [INSTAGRAM, true]] as const) {
      withUA(ua, touch, () => {
        expect(permissionHelp("microphone").steps.length).toBeGreaterThanOrEqual(3);
      });
    }
  });
});

describe("🔴 زنجیره‌ی ژست کاربر در iOS", () => {
  const voice = readCode("components/shared/voice-order.tsx");

  it("getUserMedia فقط یک بار صدا زده می‌شود", () => {
    /*
      باگ اصلی: runStart دو بار getUserMedia می‌زد — یکی در ابتدا و
      یکی چند خط بعد. سافاری موبایل دومی را خارج از ژست کاربر می‌دید
      و NotAllowedError می‌داد، بدون اینکه هرگز پنجره‌ای نشان داده
      شود. کاربر «دسترسی مسدود است» می‌دید و هر تنظیمی هم عوض می‌کرد
      فرقی نداشت، چون مجوز اصلاً مسئله نبود.
    */
    const calls = voice.match(/getUserMedia\(\{\s*audio:\s*true\s*\}\)/g) ?? [];
    expect(calls).toHaveLength(1);
  });

  it("در iOS خودکار شروع نمی‌شود", () => {
    // هر await میان لمس و getUserMedia، زنجیره‌ی ژست را می‌شکند.
    expect(voice).toContain("if (isIOS()) {");
    const iosGuard = voice.indexOf("if (isIOS()) {");
    const permQuery = voice.indexOf("navigator.permissions?.query");
    expect(iosGuard).toBeGreaterThan(-1);
    expect(iosGuard).toBeLessThan(permQuery);
  });

  it("در دسکتاپ رفتار خودکار حفظ شده", () => {
    // یک لمس اضافه آنجا فقط مزاحمت است.
    expect(voice).toContain("void startRef.current()");
  });

  it("قفل هم‌زمانی سر جایش است", () => {
    expect(voice).toContain("if (startingRef.current) return;");
  });
});

describe("یکپارچگی راهنما بین دوربین و میکروفون", () => {
  it("هر دو از ماژول مشترک استفاده می‌کنند", () => {
    // دو پیاده‌سازی یعنی روزی یکی به‌روز شود و دیگری جا بماند.
    for (const f of ["components/shared/voice-order.tsx", "components/shared/barcode-scanner.tsx"]) {
      expect(readCode(f)).toContain('from "@/lib/utils/platform"');
    }
  });

  it("بارکدخوان هم راهنمای iOS دارد", () => {
    const bc = readCode("components/shared/barcode-scanner.tsx");
    expect(bc).toContain("isIOS()");
    expect(bc).toContain("isInAppBrowser()");
    expect(bc).toContain("aA");
  });

  it("هیچ‌کدام راهنمای «قفل» را بی‌قید نشان نمی‌دهند", () => {
    /*
      اگر متن قفل بدون شرط پلتفرم بماند، دوباره همان باگ برمی‌گردد.
      در voice-order کل متن از permissionHelp می‌آید؛ در barcode
      داخل شرط سه‌گانه است.
    */
    const voice = readCode("components/shared/voice-order.tsx");
    expect(voice).not.toContain("روی آیکون قفل");
  });
});


describe("🔴 قانون هوک‌ها", () => {
  const voice = read("components/shared/voice-order.tsx");

  it("همه‌ی هوک‌ها پیش از return زودهنگام هستند", () => {
    /*
      باگی که خودم ساختم و شبیه‌سازی آیفون گرفتش:
      سه `useMemo` بعد از `if (!open || !mounted) return null` نوشته
      شده بودند. وقتی پنجره بسته است اجرا نمی‌شدند و به‌محض باز شدن
      اجرا می‌شدند → تعداد هوک‌ها بین دو رندر فرق می‌کرد → React
      error #310 و ترکیدن کل صفحه («خطای برنامه»).

      نه tsc گرفت، نه next build، نه هیچ تست واحدی — فقط رندر واقعی.
    */
    const earlyReturn = voice.indexOf("if (!open || !mounted) return null;");
    expect(earlyReturn).toBeGreaterThan(-1);

    const body = voice.slice(earlyReturn);
    // هیچ فراخوانی هوکی نباید بعد از این نقطه بیاید.
    expect(body).not.toMatch(/\buseMemo\(/);
    expect(body).not.toMatch(/\buseState\(/);
    expect(body).not.toMatch(/\buseEffect\(/);
    expect(body).not.toMatch(/\buseCallback\(/);
    expect(body).not.toMatch(/\buseRef\(/);
  });
});
