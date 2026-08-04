import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient, safeError, readJsonBody } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { firstPasswordError } from "@/lib/security/password";
import { logActivityServer } from "@/lib/utils/activity-log-server";

export const dynamic = "force-dynamic";

/**
 * تغییر رمز عبور توسط خودِ کاربر.
 *
 * 🔴 چرا لازم بود: پیش از این هیچ راهی برای تغییر رمز وجود نداشت.
 * نه در تنظیمات، نه در پروفایل. اگر کاربری رمزش را لو می‌داد یا
 * می‌خواست عوضش کند، تنها راه تماس با ما و دست‌کاری دستی دیتابیس بود.
 *
 * تصمیم امنیتی کلیدی: **رمز فعلی الزامی است.**
 *   Supabase در `updateUser({ password })` رمز فعلی را نمی‌پرسد؛ فقط
 *   نشست معتبر می‌خواهد. یعنی اگر کسی چند لحظه به لپ‌تاپِ باز کاربر
 *   دسترسی پیدا کند، می‌تواند رمز را عوض کند و صاحب حساب را بیرون
 *   بیندازد. اینجا رمز فعلی با یک ورود آزمایشی بررسی می‌شود.
 */
export async function POST(request: Request) {
  try {
    /*
      محدودیت سخت‌گیرانه: این روت یک اوراکل تأیید رمز است. بدون
      محدودیت، مهاجمی که به یک نشست دسترسی دارد می‌تواند رمز فعلی را
      brute-force کند.
    */
    const rl = hit(`password-change:${clientIp(request)}`, { limit: 5, windowSeconds: 300 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const parsed = await readJsonBody<Record<string, unknown>>(request);
    if ("response" in parsed) return parsed.response;

    const currentPassword = String(parsed.data.current_password ?? "");
    const newPassword = String(parsed.data.new_password ?? "");

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "رمز فعلی و رمز جدید الزامی است." }, { status: 400 });
    }

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validationError = firstPasswordError(newPassword, currentPassword);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    /*
      تأیید رمز فعلی.

      از یک کلاینت *جدا* استفاده می‌شود، نه `supabase` بالا:
      `signInWithPassword` روی کلاینت سرور، کوکی نشست را بازنویسی
      می‌کند. با کلاینت جداگانه‌ی بدون کوکی، نشست فعلی کاربر
      دست‌نخورده می‌ماند حتی اگر رمز اشتباه باشد.
    */
    const { createClient: createRawClient } = await import("@supabase/supabase-js");
    const verifier = createRawClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { error: signInError } = await verifier.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      return NextResponse.json({ error: "رمز فعلی درست نیست." }, { status: 403 });
    }
    // نشست موقتِ تأیید بلافاصله باطل می‌شود.
    await verifier.auth.signOut();

    const svc = serviceClient();
    const { error: updateError } = await svc.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });
    if (updateError) throw updateError;

    /*
      🔴 شمارنده‌ی تلاش‌های ناموفق هم پاک می‌شود.

      بدون این، کاربری که رمزش را عوض می‌کند شمارنده‌ی قبلی‌اش را نگه
      می‌دارد و با اولین اشتباه تایپی بلافاصله به همان سطح تأخیر
      برمی‌گردد — رفتاری که هیچ کاربری انتظارش را ندارد.
    */
    await svc.rpc("clear_login_failures", { p_login_id: user.email });

    /*
      ثبت در گزارش فعالیت.

      خودِ رمز هرگز جایی لاگ نمی‌شود — فقط این واقعیت که تغییر کرده.
      این برای پاسخ به «چه کسی و کِی رمز را عوض کرد؟» لازم است.
    */
    await logActivityServer({
      userId: user.id,
      action: "password_change",
      entityType: "user",
      entityId: user.id,
      newData: { self: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return safeError("account/password", error);
  }
}
