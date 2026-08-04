import { NextResponse } from "next/server";
import { activeProvider, type MarketQuote } from "@/lib/market/providers";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * قیمت‌های بازار — دلار، طلا، سکه، ارز دیجیتال.
 *
 * چرا از سرور و نه مستقیم از مرورگر؟
 *   ۱. CSP سایت `connect-src` را محدود می‌کند؛ افزودن دامنه‌ی هر منبع
 *      تازه یعنی تغییر هدر امنیتی برای همه.
 *   ۲. tgju هدر CORS نمی‌دهد، پس فراخوانی مستقیم از مرورگر مسدود است.
 *   ۳. مهم‌تر: یک کش مشترک. اگر ۵۰ کاربر همزمان آنلاین باشند و هر
 *      مرورگر خودش هر دقیقه بپرسد، ۵۰ درخواست در دقیقه به منبع
 *      رایگان می‌رود و به‌سرعت مسدود می‌شویم.
 */

type CacheEntry = { at: number; quotes: MarketQuote[] };

/*
  کش درون‌حافظه‌ای per-instance.

  ⚠️ صادقانه: روی Vercel هر instance کش خودش را دارد، پس با چند
  instance ممکن است چند برابر TTL درخواست برود. برای این حجم مسئله‌ای
  نیست؛ اگر روزی ترافیک زیاد شد، همین شیء با Redis جایگزین می‌شود و
  امضای تابع ثابت می‌ماند.
*/
let cache: CacheEntry | null = null;

/**
 * ۹۰ ثانیه.
 *
 * چرا نه کمتر؟ نرخ ارز آزاد در عمل هر چند دقیقه یک‌بار تغییر می‌کند؛
 * کمتر از این فقط به منبع فشار می‌آورد.
 * چرا نه بیشتر؟ کاربر انتظار دارد عدد «امروز» باشد، نه ربع ساعت پیش.
 */
const TTL_MS = 90_000;

/**
 * اگر منبع از کار افتاد ولی کش کهنه‌ای داریم، تا این سقف همان را
 * می‌دهیم و با پرچم `stale` علامت می‌زنیم.
 *
 * نمایش عدد یک ساعت پیش با برچسب «به‌روزرسانی ناموفق» بسیار بهتر از
 * نوار خالی است — کاربر حداقل می‌داند بازار کجا بوده.
 */
const STALE_MS = 60 * 60_000;

export async function GET(request: Request) {
  try {
    /*
      محدودیت نرخ سخاوتمندانه است چون پاسخ معمولاً از کش می‌آید و
      هزینه‌ای ندارد؛ هدف فقط جلوگیری از سوءاستفاده‌ی آشکار است.
    */
    const rl = hit(`market:${clientIp(request)}`, { limit: 120, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const now = Date.now();

    if (cache && now - cache.at < TTL_MS) {
      return NextResponse.json({
        quotes: cache.quotes,
        updatedAt: new Date(cache.at).toISOString(),
        stale: false,
        source: activeProvider().id,
      });
    }

    const controller = new AbortController();
    /*
      سقف زمان. بدون این، یک منبع کند کل رندر هدر را نگه می‌دارد.
      ۸ ثانیه برای چهار میزبان جا دارد (اندازه‌گیری: هر کدام ~۶۵ms).
    */
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const quotes = await activeProvider().fetchQuotes(controller.signal);
      cache = { at: now, quotes };
      return NextResponse.json({
        quotes,
        updatedAt: new Date(now).toISOString(),
        stale: false,
        source: activeProvider().id,
      });
    } catch (error) {
      // منبع در دسترس نیست — کش کهنه بهتر از هیچ است.
      if (cache && now - cache.at < STALE_MS) {
        return NextResponse.json({
          quotes: cache.quotes,
          updatedAt: new Date(cache.at).toISOString(),
          stale: true,
          source: activeProvider().id,
        });
      }
      /*
        نه کش داریم نه منبع. 200 برمی‌گردانیم با آرایه‌ی خالی، نه 500:
        این یک ویجت جانبی است و نباید در کنسول کاربر خطای قرمز بسازد
        یا باعث retry پیاپی react-query شود.
      */
      return NextResponse.json({
        quotes: [],
        updatedAt: null,
        stale: true,
        error: "دریافت قیمت‌ها ناموفق بود",
        source: activeProvider().id,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return NextResponse.json({ quotes: [], updatedAt: null, stale: true, error: "خطای غیرمنتظره" });
  }
}
