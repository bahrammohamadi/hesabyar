import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseNumber,
  parseChange,
  isSameTehranDay,
  TGJU_SYMBOLS,
  VALID_QUOTE_IDS,
  DEFAULT_QUOTE_IDS,
} from "../lib/market/providers";
import { sanitize, moveItem, DEFAULT_PREFS } from "../lib/market/preferences";
import { findCity, describeWeather, isNightAt, IRAN_CITIES } from "../lib/market/weather";
import { formatQuoteValue, formatChange, formatTemp } from "../lib/market/format";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("تجزیه‌ی پاسخ منبع قیمت", () => {
  it("جداکننده‌ی هزارگان را می‌فهمد", () => {
    expect(parseNumber("1,928,800")).toBe(1928800);
    expect(parseNumber("63685.07")).toBe(63685.07);
    expect(parseNumber(4062.66)).toBe(4062.66);
  });

  it("ورودی نامعتبر را null می‌دهد نه NaN", () => {
    // یک نماد خراب نباید کل نوار را از کار بیندازد.
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
    expect(parseNumber(NaN)).toBeNull();
  });

  it("جهت تغییر از dt خوانده می‌شود نه علامت dp", () => {
    /*
      🔴 tgju همیشه dp را بدون علامت می‌دهد؛ جهت در dt است.
      بدون این، افت قیمت هم سبز نشان داده می‌شد — برعکس واقعیت.
    */
    expect(parseChange({ dp: "0.39", dt: "low" })).toBe(-0.39);
    expect(parseChange({ dp: "0.21", dt: "high" })).toBe(0.21);
    expect(parseChange({ dp: "0", dt: "" })).toBe(0);
  });

  it("dt خالی با dp غیرصفر مثبت فرض می‌شود", () => {
    expect(parseChange({ dp: "1.5", dt: "" })).toBe(1.5);
  });
});

describe("تشخیص بازار بسته", () => {
  /*
    اندازه‌گیری واقعی روی پاسخ زنده: ساعت ۱۰ صبح ۱۳ مرداد، دلار و سکه
    ts دیروز داشتند ولی بیت‌کوین همان دقیقه به‌روز بود.
  */
  const now = new Date("2026-08-04T07:00:00Z"); // ۱۰:۳۰ به وقت تهران

  it("قیمت امروز را امروز می‌شناسد", () => {
    expect(isSameTehranDay("2026-08-04 10:21:21", now)).toBe(true);
  });

  it("قیمت دیروز را امروز نمی‌شناسد", () => {
    expect(isSameTehranDay("2026-08-03 00:00:00", now)).toBe(false);
  });

  it("مقایسه به وقت تهران است نه UTC", () => {
    /*
      ۲۱:۰۰ تهران = ۱۷:۳۰ UTC همان روز.
      اگر با UTC مقایسه می‌شد، بین ۲۰:۳۰ تا نیمه‌شب تهران همه‌چیز
      «دیروز» به نظر می‌رسید.
    */
    const evening = new Date("2026-08-04T17:30:00Z");
    expect(isSameTehranDay("2026-08-04 21:00:00", evening)).toBe(true);
  });

  it("ورودی خالی یا بدشکل false می‌دهد", () => {
    expect(isSameTehranDay(null, now)).toBe(false);
    expect(isSameTehranDay("نامعتبر", now)).toBe(false);
  });
});

describe("واحد و مقیاس نمادها", () => {
  it("ارزها ریال‌اند و بر ۱۰ تقسیم می‌شوند", () => {
    const usd = TGJU_SYMBOLS.find((s) => s.id === "usd")!;
    expect(usd.divisor).toBe(10);
    expect(usd.unit).toBe("toman");
    // 1,928,800 ریال → 192,880 تومان
    expect(1928800 / usd.divisor).toBe(192880);
  });

  it("ارز دیجیتال دلاری است و تقسیم نمی‌شود", () => {
    /*
      🔴 اگر divisor=10 می‌گذاشتیم، بیت‌کوین ۶٬۳۶۸ نشان داده می‌شد
      به‌جای ۶۳٬۶۸۵ دلار.
    */
    for (const id of ["btc", "eth", "usdt", "ons"]) {
      const sym = TGJU_SYMBOLS.find((s) => s.id === id)!;
      expect(sym.divisor).toBe(1);
      expect(sym.unit).toBe("usd");
    }
  });

  it("شناسه‌ها یکتا هستند", () => {
    const ids = TGJU_SYMBOLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("پیش‌فرض‌ها همگی معتبرند", () => {
    for (const id of DEFAULT_QUOTE_IDS) expect(VALID_QUOTE_IDS.has(id)).toBe(true);
  });
});

describe("تنظیمات شخصی", () => {
  it("شناسه‌ی نامعتبر حذف می‌شود", () => {
    /*
      🔴 اگر نسخه‌ی بعدی نمادی را حذف کند، مقدار ذخیره‌شده در
      localStorage نامعتبر می‌ماند و آن کاشی هرگز رندر نمی‌شود —
      کاربر فکر می‌کند نوار خراب است.
    */
    const out = sanitize({ quoteIds: ["usd", "نماد_حذف_شده", "btc"] });
    expect(out.quoteIds).toEqual(["usd", "btc"]);
  });

  it("تکراری‌ها حذف می‌شوند", () => {
    expect(sanitize({ quoteIds: ["usd", "usd", "btc"] }).quoteIds).toEqual(["usd", "btc"]);
  });

  it("شهر نامعتبر به تهران برمی‌گردد", () => {
    expect(sanitize({ cityId: "شهر_خیالی" }).cityId).toBe("tehran");
  });

  it("ورودی خراب کل تنظیمات را پیش‌فرض می‌کند", () => {
    expect(sanitize(null)).toEqual(DEFAULT_PREFS);
    expect(sanitize("رشته")).toEqual(DEFAULT_PREFS);
  });

  it("آرایه‌ی خالی مجاز است (کاربر همه را برداشته)", () => {
    expect(sanitize({ quoteIds: [] }).quoteIds).toEqual([]);
  });

  it("ترتیب انتخاب کاربر حفظ می‌شود", () => {
    expect(sanitize({ quoteIds: ["btc", "usd"] }).quoteIds).toEqual(["btc", "usd"]);
  });

  it("جابه‌جایی آیتم درست کار می‌کند", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("جابه‌جایی خارج از محدوده فهرست را خراب نمی‌کند", () => {
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], -1, 0)).toEqual(["a", "b"]);
  });
});

describe("آب‌وهوا", () => {
  it("شهرها شناسه‌ی یکتا و مختصات معتبر دارند", () => {
    const ids = IRAN_CITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of IRAN_CITIES) {
      // محدوده‌ی جغرافیایی ایران
      expect(c.lat).toBeGreaterThan(24);
      expect(c.lat).toBeLessThan(40);
      expect(c.lon).toBeGreaterThan(43);
      expect(c.lon).toBeLessThan(64);
    }
  });

  it("شهر ناشناخته به اولین شهر برمی‌گردد", () => {
    expect(findCity("ناشناخته").id).toBe("tehran");
    expect(findCity(null).id).toBe("tehran");
  });

  it("کد WMO به فارسی ترجمه می‌شود", () => {
    expect(describeWeather(0, false).label).toBe("صاف");
    expect(describeWeather(95, false).label).toBe("رعد و برق");
    expect(describeWeather(71, false).label).toBe("برف سبک");
  });

  it("شب آیکون ماه می‌گیرد", () => {
    expect(describeWeather(0, false).icon).toBe("sun");
    expect(describeWeather(0, true).icon).toBe("moon");
    expect(describeWeather(1, true).icon).toBe("cloud-moon");
  });

  it("کد ناشناخته باعث خطا نمی‌شود", () => {
    expect(describeWeather(999, false).label).toBe("نامشخص");
  });

  it("تشخیص شب از ساعت محلی", () => {
    expect(isNightAt("2026-08-04T22:00")).toBe(true);
    expect(isNightAt("2026-08-04T03:00")).toBe(true);
    expect(isNightAt("2026-08-04T12:00")).toBe(false);
  });
});

describe("قالب‌بندی", () => {
  it("تومان با جداکننده و رقم فارسی", () => {
    expect(formatQuoteValue(192880, "toman", false)).toBe("۱۹۲,۸۸۰");
  });

  it("اعداد بزرگ در حالت فشرده خلاصه می‌شوند", () => {
    // سکه ۱۸۴٬۹۹۵٬۰۰۰ در نوار باریک جا نمی‌شود
    expect(formatQuoteValue(184995000, "toman", true)).toBe("۱۸۵.۰ م");
  });

  it("دلار زیر یک با ۴ رقم اعشار", () => {
    // دوج‌کوین و مشابه، وگرنه «۰» نشان داده می‌شد
    expect(formatQuoteValue(0.0693, "usd", true)).toContain("۰.۰۶۹۳");
  });

  it("تتر با ۲ رقم اعشار نه صفر", () => {
    expect(formatQuoteValue(1, "usd", true)).toBe("۱.۰۰");
  });

  it("بیت‌کوین بدون اعشار", () => {
    expect(formatQuoteValue(63685.07, "usd", true)).toBe("۶۳,۶۸۵");
  });

  it("درصد با علامت درست", () => {
    expect(formatChange(0.39)).toBe("+۰.۳۹٪");
    expect(formatChange(-1.2)).toBe("−۱.۲۰٪");
    expect(formatChange(0)).toBe("۰٪");
  });

  it("دما با رقم فارسی", () => {
    expect(formatTemp(32)).toBe("۳۲°");
    expect(formatTemp(-5)).toBe("−۵°");
  });
});

describe("امنیت و یکپارچگی", () => {
  it("روت‌های بازار عمومی نیستند", () => {
    /*
      اگر عمومی بودند، سایت به پراکسی رایگان tgju و open-meteo تبدیل
      می‌شد که هر کسی می‌توانست سهمیه‌ی ما را بسوزاند.
    */
    const mw = read("lib/supabase/middleware.ts");
    expect(mw).not.toContain('path === "/api/market"');
    expect(mw).not.toContain('path === "/api/weather"');
  });

  it("شهر از فهرست سفید حل می‌شود نه lat/lon آزاد", () => {
    // وگرنه روت به پراکسی باز برای open-meteo تبدیل می‌شد.
    const route = read("app/api/weather/route.ts");
    expect(route).toContain("findCity(url.searchParams.get(\"city\"))");
    expect(route).not.toContain('searchParams.get("lat")');
  });

  it("CSP تغییر نکرده چون از سرور می‌خوانیم", () => {
    const cfg = read("next.config.mjs");
    expect(cfg).not.toContain("tgju.org");
    expect(cfg).not.toContain("open-meteo");
  });

  it("منبع قیمت قابل تعویض است", () => {
    // کاربر خواست بعداً بتواند سرویس پولی جایگزین کند.
    const src = read("lib/market/providers.ts");
    expect(src).toContain("interface MarketProvider");
    expect(src).toContain("export function activeProvider()");
  });

  it("کش سروری دارد تا منبع رایگان را نسوزاند", () => {
    const route = read("app/api/market/route.ts");
    expect(route).toContain("TTL_MS");
    expect(route).toContain("STALE_MS");
  });

  it("چند میزبان جایگزین برای tgju", () => {
    const src = read("lib/market/providers.ts");
    expect(src).toContain("call1.tgju.org");
    expect(src).toContain("call2.tgju.org");
  });
});
