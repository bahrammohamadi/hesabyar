/**
 * منابع قیمت بازار — لایه‌ی قابل تعویض.
 *
 * چرا این ساختار؟
 *   کاربر خواست «طوری بساز که بعداً بتوانم یک سرویس پولی جایگزین کنم».
 *   پس هر منبع یک `MarketProvider` است و بقیه‌ی برنامه فقط با
 *   `MarketQuote` کار می‌کند. افزودن یک منبع تازه = یک فایل، بدون
 *   دست‌زدن به UI.
 *
 * انتخاب منبع پیش‌فرض بر اساس آزمایش واقعی انجام شد، نه ادعای سایت‌ها:
 *
 *   nerkh.io        → تایم‌اوت کامل (۱۲ ثانیه، بدون پاسخ)
 *   brsapi.ir       → تایم‌اوت کامل
 *   alanchand.com   → HTTP 401، توکن لازم دارد
 *   nerkh-api.ir    → "Invalid API"، توکن لازم دارد
 *   tgju.org        → ۶/۶ موفق، میانگین ۶۵ms، ۷۵۶ نماد، بدون کلید ✅
 *
 * tgju چهار دامنه‌ی هم‌ارز دارد (call, call1, call2, call3) که همگی
 * جواب دادند؛ از همین برای fallback استفاده می‌شود.
 */

export type QuoteKind = "currency" | "gold" | "crypto";

export interface MarketQuote {
  /** شناسه‌ی پایدار برای ذخیره در تنظیمات کاربر. */
  id: string;
  label: string;
  kind: QuoteKind;
  /** مقدار عددی خام. */
  value: number;
  /** واحد نمایش. */
  unit: "toman" | "usd";
  /** درصد تغییر نسبت به روز قبل. مثبت/منفی/صفر. */
  changePercent: number;
  /** زمان آخرین به‌روزرسانی منبع، ISO یا متن خام منبع. */
  updatedAt: string | null;
  /**
   * آیا این قیمت مربوط به امروز است؟
   *
   * 🔴 چرا لازم شد: در اندازه‌گیری واقعی دیده شد بازار ارز و طلای
   * ایران شب‌ها و روزهای تعطیل بسته است و tgju همان قیمت پایانی روز
   * قبل را با `dp=0` برمی‌گرداند، در حالی که بیت‌کوین و انس جهانی
   * زنده‌اند (ts همان دقیقه).
   *
   * بدون این پرچم، کاربر عدد دیروز را «قیمت لحظه‌ای» فرض می‌کند —
   * که برای کسی که می‌خواهد بر مبنایش قیمت‌گذاری کند خطرناک است.
   */
  isToday: boolean;
}

export interface MarketProvider {
  id: string;
  label: string;
  /** آیا این منبع کلید می‌خواهد؟ برای پیام خطای دقیق‌تر. */
  needsKey: boolean;
  fetchQuotes(signal: AbortSignal): Promise<MarketQuote[]>;
}

/* ------------------------------------------------------------------ */
/* نمادهای مورد استفاده                                                */
/* ------------------------------------------------------------------ */

/**
 * نگاشت نمادهای tgju به شناسه و برچسب فارسی.
 *
 * ⚠️ `scale`: tgju قیمت ارزها را به **ریال** می‌دهد (دلار = 1,928,800).
 * برای نمایش تومانی بر ۱۰ تقسیم می‌شود. طلا و سکه هم ریال‌اند.
 * ارز دیجیتال ولی **دلاری** است و نباید تقسیم شود — این تفاوت اگر
 * نادیده گرفته شود، بیت‌کوین را ۶٬۳۶۸ تومان نشان می‌دهد.
 */
export const TGJU_SYMBOLS: {
  key: string;
  id: string;
  label: string;
  kind: QuoteKind;
  unit: "toman" | "usd";
  /** مقسوم‌علیه برای تبدیل به واحد نمایش. */
  divisor: number;
}[] = [
  { key: "price_dollar_rl", id: "usd", label: "دلار", kind: "currency", unit: "toman", divisor: 10 },
  { key: "price_eur", id: "eur", label: "یورو", kind: "currency", unit: "toman", divisor: 10 },
  { key: "price_gbp", id: "gbp", label: "پوند", kind: "currency", unit: "toman", divisor: 10 },
  { key: "price_aed", id: "aed", label: "درهم", kind: "currency", unit: "toman", divisor: 10 },
  { key: "price_try", id: "try", label: "لیر", kind: "currency", unit: "toman", divisor: 10 },
  { key: "sekee", id: "coin_emami", label: "سکه امامی", kind: "gold", unit: "toman", divisor: 10 },
  { key: "sekeb", id: "coin_bahar", label: "سکه بهار", kind: "gold", unit: "toman", divisor: 10 },
  { key: "nim", id: "coin_half", label: "نیم سکه", kind: "gold", unit: "toman", divisor: 10 },
  { key: "rob", id: "coin_quarter", label: "ربع سکه", kind: "gold", unit: "toman", divisor: 10 },
  { key: "geram18", id: "gold18", label: "طلای ۱۸ عیار", kind: "gold", unit: "toman", divisor: 10 },
  { key: "geram24", id: "gold24", label: "طلای ۲۴ عیار", kind: "gold", unit: "toman", divisor: 10 },
  { key: "mesghal", id: "mesghal", label: "مثقال طلا", kind: "gold", unit: "toman", divisor: 10 },
  { key: "ons", id: "ons", label: "انس جهانی", kind: "gold", unit: "usd", divisor: 1 },
  { key: "crypto-bitcoin", id: "btc", label: "بیت‌کوین", kind: "crypto", unit: "usd", divisor: 1 },
  { key: "crypto-ethereum", id: "eth", label: "اتریوم", kind: "crypto", unit: "usd", divisor: 1 },
  { key: "crypto-tether", id: "usdt", label: "تتر", kind: "crypto", unit: "usd", divisor: 1 },
];

/** شناسه‌های معتبر — برای اعتبارسنجی تنظیمات ذخیره‌شده‌ی کاربر. */
export const VALID_QUOTE_IDS = new Set(TGJU_SYMBOLS.map((s) => s.id));

/** پیش‌فرض وقتی کاربر هنوز چیزی انتخاب نکرده. */
export const DEFAULT_QUOTE_IDS = ["usd", "coin_emami", "gold18", "btc"];

/* ------------------------------------------------------------------ */
/* کمکی‌های تجزیه                                                      */
/* ------------------------------------------------------------------ */

/**
 * «1,928,800» → 1928800
 *
 * جداکننده‌ی هزارگان و فاصله‌ها حذف می‌شوند. اگر عدد نبود null
 * برمی‌گردد تا نماد خراب کل پاسخ را از کار نیندازد.
 */
export function parseNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * درصد تغییر. tgju در `dp` می‌دهد ولی همیشه بدون علامت است؛
 * جهت در `dt` می‌آید («high» یا «low»).
 *
 * 🔴 بدون توجه به `dt`، افت قیمت هم سبز نشان داده می‌شود — یعنی
 * دقیقاً برعکس واقعیت.
 */
export function parseChange(entry: Record<string, unknown>): number {
  const dp = parseNumber(entry.dp) ?? 0;
  if (dp === 0) return 0;
  const dt = String(entry.dt ?? "").toLowerCase();
  return dt === "low" ? -Math.abs(dp) : Math.abs(dp);
}

/**
 * آیا این زمان مربوط به «امروز» به وقت تهران است؟
 *
 * tgju زمان را به شکل «2026-08-03 00:00:00» و به وقت تهران می‌دهد.
 * مقایسه با تاریخ امروزِ تهران انجام می‌شود، نه UTC — وگرنه بین
 * ساعت ۲۰:۳۰ تا ۲۴ به وقت تهران، همه‌چیز «دیروز» به نظر می‌رسید.
 */
export function isSameTehranDay(ts: string | null, now = new Date()): boolean {
  if (!ts) return false;
  const day = ts.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const todayTehran = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return day === todayTehran;
}

/* ------------------------------------------------------------------ */
/* منبع اصلی: tgju                                                     */
/* ------------------------------------------------------------------ */

/**
 * دامنه‌های هم‌ارز. هر چهار مورد در آزمایش ۲۰۰ دادند؛ اگر یکی افتاد
 * بعدی امتحان می‌شود.
 */
const TGJU_HOSTS = ["call1.tgju.org", "call2.tgju.org", "call3.tgju.org", "call.tgju.org"];

export const tgjuProvider: MarketProvider = {
  id: "tgju",
  label: "tgju.org",
  needsKey: false,

  async fetchQuotes(signal) {
    let lastError: unknown = null;

    for (const host of TGJU_HOSTS) {
      try {
        const res = await fetch(`https://${host}/ajax.json`, {
          signal,
          headers: {
            // بدون UA، بعضی CDNها درخواست را بات تشخیص می‌دهند.
            "User-Agent": "Mozilla/5.0 (compatible; TarazooBot/1.0)",
            Accept: "application/json",
          },
          // کش خودمان را داریم؛ کش fetch نکست اینجا مزاحم است.
          cache: "no-store",
        });
        if (!res.ok) {
          lastError = new Error(`${host} → HTTP ${res.status}`);
          continue;
        }
        const json = (await res.json()) as { current?: Record<string, Record<string, unknown>> };
        const current = json.current;
        if (!current || typeof current !== "object") {
          lastError = new Error(`${host} → پاسخ بدون بخش current`);
          continue;
        }

        const quotes: MarketQuote[] = [];
        for (const sym of TGJU_SYMBOLS) {
          const entry = current[sym.key];
          if (!entry) continue;
          const raw = parseNumber(entry.p);
          if (raw === null) continue;
          const ts = typeof entry.ts === "string" ? entry.ts : null;
          quotes.push({
            id: sym.id,
            label: sym.label,
            kind: sym.kind,
            value: raw / sym.divisor,
            unit: sym.unit,
            changePercent: parseChange(entry),
            updatedAt: ts,
            isToday: isSameTehranDay(ts),
          });
        }

        /*
          اگر هیچ نمادی تجزیه نشد یعنی ساختار پاسخ عوض شده. بهتر است
          به میزبان بعدی برویم تا اینکه یک آرایه‌ی خالی برگردانیم و
          کاربر نوار خالی ببیند.
        */
        if (quotes.length === 0) {
          lastError = new Error(`${host} → هیچ نمادی شناسایی نشد`);
          continue;
        }
        return quotes;
      } catch (error) {
        lastError = error;
        // AbortError یعنی کل درخواست لغو شده؛ ادامه دادن بی‌فایده است.
        if (error instanceof Error && error.name === "AbortError") throw error;
      }
    }

    throw lastError ?? new Error("هیچ‌کدام از میزبان‌های tgju پاسخ ندادند");
  },
};

/* ------------------------------------------------------------------ */
/* انتخاب منبع                                                         */
/* ------------------------------------------------------------------ */

/**
 * منبع فعال.
 *
 * برای جایگزینی با یک سرویس پولی در آینده، کافی است یک
 * MarketProvider تازه بنویسید و اینجا برگردانید — مثلاً بر اساس
 * وجود `process.env.MARKET_API_KEY`. بقیه‌ی برنامه تغییری نمی‌کند.
 */
export function activeProvider(): MarketProvider {
  return tgjuProvider;
}
