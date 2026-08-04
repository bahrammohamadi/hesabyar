import { NextResponse } from "next/server";
import { findCity, describeWeather, isNightAt, type WeatherNow } from "@/lib/market/weather";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * آب‌وهوای شهر انتخابی کاربر.
 *
 * مثل قیمت‌ها از سرور خوانده می‌شود تا کش مشترک باشد و CSP کلاینت
 * دست‌نخورده بماند. کش به‌ازای هر شهر جداست.
 */

type CacheEntry = { at: number; data: WeatherNow };
const cache = new Map<string, CacheEntry>();

/**
 * ۱۰ دقیقه.
 *
 * دما در بازه‌ی کوتاه‌تر عملاً تغییر نمی‌کند و خود open-meteo هم
 * داده را هر ۱۵ دقیقه به‌روز می‌کند (`interval: 900` در پاسخ).
 */
const TTL_MS = 10 * 60_000;

/** سقف اندازه‌ی کش تا با شهرهای زیاد حافظه نشت نکند. */
const MAX_CACHE = 60;

export async function GET(request: Request) {
  try {
    const rl = hit(`weather:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const url = new URL(request.url);
    /*
      شناسه‌ی شهر از فهرست سفید داخلی حل می‌شود، نه lat/lon آزاد از
      کوئری. اگر مختصات دلخواه می‌پذیرفتیم، این روت به یک پراکسی باز
      تبدیل می‌شد که هر کسی می‌توانست با آن به open-meteo درخواست بزند.
    */
    const city = findCity(url.searchParams.get("city"));
    const now = Date.now();

    const cached = cache.get(city.id);
    if (cached && now - cached.at < TTL_MS) {
      return NextResponse.json({ weather: cached.data, stale: false });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const api = new URL("https://api.open-meteo.com/v1/forecast");
      api.searchParams.set("latitude", String(city.lat));
      api.searchParams.set("longitude", String(city.lon));
      api.searchParams.set("current", "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m");
      api.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
      api.searchParams.set("timezone", "Asia/Tehran");
      api.searchParams.set("forecast_days", "1");

      const res = await fetch(api, { signal: controller.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`open-meteo → HTTP ${res.status}`);

      const json = (await res.json()) as {
        current?: { time?: string; temperature_2m?: number; relative_humidity_2m?: number; weather_code?: number; wind_speed_10m?: number };
        daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
      };

      const current = json.current;
      if (!current || typeof current.temperature_2m !== "number") {
        throw new Error("پاسخ آب‌وهوا ناقص بود");
      }

      const night = isNightAt(current.time ?? "");
      const code = current.weather_code ?? 0;
      const { label, icon } = describeWeather(code, night);

      const data: WeatherNow = {
        cityId: city.id,
        cityName: city.name,
        temperature: Math.round(current.temperature_2m),
        humidity: typeof current.relative_humidity_2m === "number" ? current.relative_humidity_2m : null,
        windSpeed: typeof current.wind_speed_10m === "number" ? Math.round(current.wind_speed_10m) : null,
        max: typeof json.daily?.temperature_2m_max?.[0] === "number" ? Math.round(json.daily.temperature_2m_max[0]) : null,
        min: typeof json.daily?.temperature_2m_min?.[0] === "number" ? Math.round(json.daily.temperature_2m_min[0]) : null,
        code,
        label,
        icon,
        isNight: night,
      };

      // پیش از افزودن، کهنه‌ترین ورودی حذف می‌شود.
      if (cache.size >= MAX_CACHE) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (oldest) cache.delete(oldest[0]);
      }
      cache.set(city.id, { at: now, data });

      return NextResponse.json({ weather: data, stale: false });
    } catch {
      // کش کهنه بهتر از هیچ — دمای ۲۰ دقیقه پیش هنوز مفید است.
      if (cached) return NextResponse.json({ weather: cached.data, stale: true });
      return NextResponse.json({ weather: null, stale: true, error: "دریافت آب‌وهوا ناموفق بود" });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return NextResponse.json({ weather: null, stale: true, error: "خطای غیرمنتظره" });
  }
}
