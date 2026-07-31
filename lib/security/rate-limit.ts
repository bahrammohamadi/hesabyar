/**
 * محدودکننده‌ی نرخ درخواست (Rate Limiter) — الگوریتم پنجره‌ی لغزان.
 *
 * چرا در حافظه؟
 *   پروژه روی Vercel اجرا می‌شود و هنوز Redis/Upstash ندارد. نسخه‌ی درون‌حافظه‌ای
 *   در هر instance جدا عمل می‌کند، پس در مقیاس چند-instance «کامل» نیست؛
 *   ولی حمله‌ی brute-force از یک IP را عملاً بی‌اثر می‌کند و صفر وابستگی دارد.
 *
 *   وقتی به Redis مهاجرت کردید، فقط پیاده‌سازی `hit()` عوض می‌شود و
 *   امضای تابع ثابت می‌ماند.
 *
 * ⚠️ نکته‌ی صادقانه: این جایگزین rate limit سمت Supabase Auth نیست.
 *    برای ورود، محدودیت واقعی باید در تنظیمات Supabase هم فعال شود.
 */

type Bucket = { hits: number[]; blockedUntil: number };

const buckets = new Map<string, Bucket>();

/** هر ۵ دقیقه کلیدهای مرده پاک می‌شوند تا حافظه نشت نکند. */
const CLEANUP_INTERVAL_MS = 5 * 60_000;
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    const fresh = bucket.hits.filter((t) => now - t < 60 * 60_000);
    if (fresh.length === 0 && bucket.blockedUntil < now) buckets.delete(key);
    else bucket.hits = fresh;
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimitOptions = {
  /** تعداد مجاز درخواست در بازه. */
  limit: number;
  /** طول بازه بر حسب ثانیه. */
  windowSeconds: number;
  /** مدت مسدودی پس از عبور از حد (ثانیه). پیش‌فرض: طول بازه. */
  blockSeconds?: number;
};

/**
 * یک درخواست را ثبت و وضعیت مجاز بودن را برمی‌گرداند.
 * `key` باید شامل شناسه‌ی مهاجم باشد (IP و در صورت وجود، شناسه‌ی کاربر).
 */
export function hit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  const windowMs = options.windowSeconds * 1000;
  const blockMs = (options.blockSeconds ?? options.windowSeconds) * 1000;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [], blockedUntil: 0 };
    buckets.set(key, bucket);
  }

  if (bucket.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000),
    };
  }

  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= options.limit) {
    bucket.blockedUntil = now + blockMs;
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil(blockMs / 1000) };
  }

  bucket.hits.push(now);
  return {
    allowed: true,
    remaining: Math.max(0, options.limit - bucket.hits.length),
    retryAfterSeconds: 0,
  };
}

/**
 * IP واقعی کاربر را از هدرهای پراکسی استخراج می‌کند.
 *
 * روی Vercel، `x-forwarded-for` توسط خود پلتفرم ست می‌شود و اولین مقدار
 * IP کلاینت است. چون هدر قابل جعل است، فقط به‌عنوان کلیدِ نرخ استفاده
 * می‌شود و هرگز مبنای تصمیم امنیتی (احراز هویت) قرار نمی‌گیرد.
 */
export function clientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

/** پاسخ استاندارد ۴۲۹ همراه با هدر Retry-After. */
export function tooManyRequests(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({ error: "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    }
  );
}
