import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient, safeError, readJsonBody } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * ورود با کندسازی تلاش‌های ناموفق.
 *
 * چرا ورود از سرور عبور می‌کند؟
 *   صفحه‌ی ورود قبلاً مستقیم `signInWithPassword` را از مرورگر صدا
 *   می‌زد. یعنی هیچ نقطه‌ای برای شمردن تلاش‌های ناموفق وجود نداشت و
 *   مهاجم می‌توانست بی‌نهایت رمز امتحان کند.
 *
 *   دو راه ساده‌تر آزمایش و رد شدند — هر دو در پلن رایگان بسته‌اند:
 *     sessions_timebox        → "only on Pro Plans and up"
 *     password verification hook → "cannot be configured for this organization"
 *
 * 🔴 دو قاعده‌ی امنیتی که رعایت شده:
 *
 *   ۱. پاسخ هرگز نمی‌گوید کدام حساب وجود دارد.
 *      چه ایمیل ناموجود باشد، چه رمز غلط، چه حساب در حال کندسازی —
 *      همان پیام و همان کد وضعیت برمی‌گردد. کد ۴۲۳ یا پیام متفاوت
 *      برای «قفل است» به مهاجم می‌گوید این حساب واقعی است.
 *
 *   ۲. شمارنده بر اساس شناسه‌ی ورود است نه user_id.
 *      اگر فقط برای کاربران موجود رکورد می‌ساختیم، تفاوت زمان پاسخ
 *      خودش نشت اطلاعات بود.
 */
export async function POST(request: Request) {
  try {
    /*
      لایه‌ی اول: محدودیت مبتنی بر IP.

      این جدا از کندسازی per-account است و هدف متفاوتی دارد: جلوگیری
      از credential stuffing که هر بار یک *حساب متفاوت* را امتحان
      می‌کند و بنابراین هیچ‌وقت به آستانه‌ی per-account نمی‌رسد.
    */
    const rl = hit(`login-ip:${clientIp(request)}`, { limit: 30, windowSeconds: 300 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const parsed = await readJsonBody<Record<string, unknown>>(request);
    if ("response" in parsed) return parsed.response;

    const loginId = String(parsed.data.login_id ?? "").trim().toLowerCase();
    const password = String(parsed.data.password ?? "");

    if (!loginId || !password) {
      return NextResponse.json({ error: "نام کاربری و رمز عبور الزامی است." }, { status: 400 });
    }

    const svc = serviceClient();

    /*
      سابقه‌ی ورود جدا از شمارنده‌ی کندسازی ثبت می‌شود.

      🔴 چرا لازم است: `login_attempts` با ورود موفق **پاک می‌شود**،
      پس هیچ ردی نمی‌ماند که چه کسی کِی از کجا وارد شده. بدون سابقه،
      نفوذ هرگز کشف نمی‌شود — کاربر نمی‌تواند ببیند «دیروز ساعت ۳ شب
      از یک IP ناشناس وارد شدند».

      ⚠️ شکست ثبت سابقه نباید جلوی ورود را بگیرد. اگر این تماس خطا
      بدهد، کاربر قانونی نباید بیرون بماند — پس خطا بلعیده می‌شود.
    */
    const ip = clientIp(request);
    const userAgent = request.headers.get("user-agent");
    const logEvent = async (event: string, userId?: string | null) => {
      try {
        await svc.rpc("record_login_event", {
          p_login_id: loginId,
          p_event: event,
          p_user_id: userId ?? null,
          p_ip: ip,
          p_user_agent: userAgent,
        });
      } catch {
        // عمداً ساکت — ثبت سابقه نباید مسیر ورود را بشکند.
      }
    };

    // لایه‌ی دوم: کندسازی per-account
    const { data: waitBefore } = await svc.rpc("login_wait_seconds", { p_login_id: loginId });
    const waiting = Number(waitBefore ?? 0);
    if (waiting > 0) {
      await logEvent("throttled");
      return NextResponse.json(
        {
          error: "نام کاربری یا رمز عبور اشتباه است.",
          // فقط زمان انتظار اعلام می‌شود تا UI بتواند شمارش معکوس نشان دهد.
          retry_after: waiting,
        },
        { status: 429 }
      );
    }

    /*
      ورود واقعی روی کلاینت درخواست‌محور انجام می‌شود تا کوکی نشست
      درست ست شود. اگر با کلاینت جدا وارد می‌شدیم، نشست در مرورگر
      کاربر ساخته نمی‌شد.
    */
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginId,
      password,
    });

    if (error || !data.user) {
      const { data: waitAfter } = await svc.rpc("record_login_failure", { p_login_id: loginId });
      await logEvent("failure");
      return NextResponse.json(
        {
          error: "نام کاربری یا رمز عبور اشتباه است.",
          retry_after: Number(waitAfter ?? 0),
        },
        { status: 401 }
      );
    }

    // ورود موفق → شمارنده صفر می‌شود.
    await svc.rpc("clear_login_failures", { p_login_id: loginId });
    await logEvent("success", data.user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return safeError("auth/login", error);
  }
}
