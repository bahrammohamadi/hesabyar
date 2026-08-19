import { NextResponse } from "next/server";
import { serviceClient, safeError, readJsonBody } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { hasRealEmail, recoveryHint } from "@/lib/security/recovery";

export const dynamic = "force-dynamic";

/**
 * درخواست بازیابی رمز.
 *
 * 🔴 قاعده‌ی اصلی: پاسخ **هرگز** نمی‌گوید حساب وجود دارد یا نه.
 *   چه ایمیل ثبت شده باشد چه نه، همان پیام و همان کد وضعیت
 *   برمی‌گردد. تفاوت پاسخ = ابزار استخراج فهرست کاربران.
 *
 * دو مسیر، بر اساس نوع حساب:
 *
 *   ۱) ایمیل واقعی → لینک بازیابی Supabase
 *      ⚠️ سقف پروژه ۲ ایمیل در ساعت است (اندازه‌گیری‌شده:
 *      rate_limit_email_sent = 2). سومین کاربر در آن ساعت هیچ
 *      ایمیلی نمی‌گیرد — و همین است که مسیر دوم را ضروری می‌کند.
 *
 *   ۲) ایمیل ساختگی @hesabyar.app → راهنمای گرفتن کد از مدیر
 *      ۴ از ۶ کاربر فعلی در این دسته‌اند: با شماره‌ی موبایل
 *      ثبت‌نام کرده‌اند و صندوق ایمیلی وجود ندارد.
 */
export async function POST(request: Request) {
  try {
    /*
      محدودیت نرخ سختگیرانه.

      بدون آن، این روت به ابزار اسپم رایگان تبدیل می‌شود: مهاجم
      می‌تواند صندوق هر کسی را با ایمیل بازیابی پر کند، و سهمیه‌ی
      ۲ ایمیل در ساعتِ پروژه را هم بسوزاند تا کاربر واقعی نتواند
      رمزش را بازیابی کند (انکار سرویس).
    */
    const rl = hit(`forgot:${clientIp(request)}`, {
      limit: 5,
      windowSeconds: 900,
      blockSeconds: 900,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const parsed = await readJsonBody<Record<string, unknown>>(request);
    if ("response" in parsed) return parsed.response;

    const loginId = String(parsed.data.login_id ?? "").trim().toLowerCase();
    if (!loginId) {
      return NextResponse.json({ error: "شناسه‌ی ورود الزامی است." }, { status: 400 });
    }

    const svc = serviceClient();

    /*
      فقط وقتی ایمیل واقعی است تلاش می‌کنیم بفرستیم.

      ⚠️ نتیجه‌ی این تماس در پاسخ منعکس **نمی‌شود**. حتی اگر Supabase
      خطا بدهد (سهمیه تمام شده، ایمیل ناموجود)، همان پیام موفقیت
      برمی‌گردد.
    */
    if (hasRealEmail(loginId)) {
      const origin = new URL(request.url).origin;
      try {
        await svc.auth.resetPasswordForEmail(loginId, {
          redirectTo: `${origin}/reset-password`,
        });
      } catch {
        // عمداً بلعیده می‌شود — نباید وجود یا نبود حساب لو برود.
      }
    }

    /*
      رویداد ثبت می‌شود حتی برای شناسه‌ی ناموجود.
      اگر فقط برای حساب‌های موجود ثبت می‌کردیم، تفاوت زمان پاسخ
      خودش نشت اطلاعات بود.
    */
    try {
      await svc.rpc("record_login_event", {
        p_login_id: loginId,
        p_event: "reset",
        p_user_id: null,
        p_ip: clientIp(request),
        p_user_agent: request.headers.get("user-agent"),
      });
    } catch {
      // ثبت سابقه نباید مسیر را بشکند.
    }

    return NextResponse.json({
      ok: true,
      // فقط *نوع مسیر* گفته می‌شود، نه وجود حساب.
      channel: hasRealEmail(loginId) ? "email" : "admin_code",
      message: recoveryHint(loginId),
    });
  } catch (error) {
    return safeError("auth/forgot-password", error);
  }
}
