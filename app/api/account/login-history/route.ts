import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeError } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { parseUserAgent } from "@/lib/security/user-agent";

export const dynamic = "force-dynamic";

/**
 * سابقه‌ی ورود کاربر جاری.
 *
 * 🔴 چرا این صفحه لازم بود: از نسخه‌ی قبل رویدادهای ورود در جدول
 * `login_events` ثبت می‌شدند ولی **هیچ جایی برای دیدنشان نبود**.
 * داده بود، رابط نبود — یعنی عملاً بی‌فایده.
 *
 * ⚠️ کلاینت درخواست‌محور استفاده می‌شود نه `service_role`.
 *   تابع `my_login_history` با `auth.uid()` فیلتر می‌کند؛ با کلید
 *   سرویس آن تهی است و تابع چیزی برنمی‌گرداند. این خودش یک لایه‌ی
 *   محافظت است: حتی اگر اینجا اشتباه کنیم، کاربر نمی‌تواند سابقه‌ی
 *   دیگری را ببیند.
 */
export async function GET(request: Request) {
  try {
    const rl = hit(`login-history:${clientIp(request)}`, { limit: 30, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase.rpc("my_login_history", { p_limit: 40 });
    // ⚠️ کلاینت Supabase برای خطای دیتابیس استثنا پرتاب نمی‌کند.
    if (error) {
      return safeError("account/login-history", error);
    }

    const events = ((data ?? []) as Array<Record<string, unknown>>).map((e) => ({
      event: e.event as string,
      ip: (e.ip as string | null) ?? null,
      /*
        رشته‌ی خام User-Agent به کلاینت فرستاده نمی‌شود.

        برچسب کوتاه («کروم روی اندروید») همان چیزی است که کاربر لازم
        دارد. فرستادن رشته‌ی کامل فقط حجم پاسخ را بالا می‌برد و در
        صفحه هم خوانا نیست.
      */
      device: parseUserAgent(e.user_agent as string | null).label,
      kind: parseUserAgent(e.user_agent as string | null).kind,
      created_at: e.created_at as string,
    }));

    return NextResponse.json({ events });
  } catch (error) {
    return safeError("account/login-history", error);
  }
}
