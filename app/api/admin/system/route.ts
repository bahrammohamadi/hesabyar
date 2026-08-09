import { NextResponse } from "next/server";
import {
  requirePlatformPermission,
  safeError,
  boundedInt,
  readJsonBody,
  requestIp,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { BRAND_VERSION, BRAND_BUILD_SHA, BRAND_BUILT_AT } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * وضعیت فنی سرویس + خطاهای زنده.
 *
 * دو مجوز جدا بررسی می‌شود چون دو حساسیت متفاوت‌اند:
 *   system.health → شاخص‌های زیرساخت. عدد است و بی‌خطر.
 *   errors.view   → متن خام خطا. می‌تواند نام جدول، ساختار کوئری و
 *                   گاهی مقدار داده‌ی مشتری را نشان بدهد — همان
 *                   چیزی که safeError عمداً از کلاینت پنهان می‌کند.
 *
 * اگر کاربر فقط اولی را داشته باشد، بخش خطاها خالی برمی‌گردد و
 * صفحه به‌جای ۴۰۳ گرفتن، بخش سلامت را نشان می‌دهد.
 */
export async function GET(request: Request) {
  try {
    const rl = hit(`admin-system:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformPermission("system.health");
    if ("response" in auth) return auth.response;

    const url = new URL(request.url);
    const limit = boundedInt(url.searchParams.get("limit"), 10, 200, 50);

    const { data: health, error } = await auth.svc.rpc("platform_health");
    if (error) throw error;

    /*
      مجوز خطاها جدا سنجیده می‌شود.

      auth.svc اینجا دوباره استفاده می‌شود ولی مجوز از دیتابیس پرسیده
      می‌شود، نه از روی نقش در کد — تک‌منبع حقیقت همان ماتریس است و
      نقش سفارشی هم باید درست کار کند.
    */
    const { data: canSeeErrors } = await auth.svc.rpc("platform_admin_can", {
      p_permission: "errors.view",
      p_user: auth.userId,
    });

    let errors: unknown[] = [];
    if (canSeeErrors === true) {
      let q = auth.svc
        .from("platform_error_logs")
        .select("id, ref, context, message, detail, path, method, status, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      // جستجو با کد ref — همان کدی که کاربر از پیام خطا می‌خواند.
      const search = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
      if (search) {
        const safe = search.replace(/[%_,()]/g, " ").trim();
        if (safe) q = q.or(`ref.ilike.%${safe}%,context.ilike.%${safe}%`);
      }

      const { data } = await q;
      errors = data ?? [];
    }

    return NextResponse.json({
      health: health ?? {},
      errors,
      canSeeErrors: canSeeErrors === true,
      /*
        نسخه‌ی بیلد در حال اجرا. کنار شاخص‌های دیتابیس معنا پیدا
        می‌کند: وقتی خطاها ناگهان زیاد می‌شوند، اولین سؤال همیشه
        «چه چیزی تازه دیپلوی شده؟» است.
      */
      build: { version: BRAND_VERSION, sha: BRAND_BUILD_SHA, builtAt: BRAND_BUILT_AT },
      viewerRole: auth.role,
    });
  } catch (error) {
    return safeError("admin/system:GET", error, 500, request);
  }
}

/**
 * پاک‌سازی خطاهای قدیمی.
 *
 * ⚠️ صادقانه: هیچ زمان‌بندی خودکاری (pg_cron) روی پلن رایگان نداریم،
 * پس این دکمه دستی است. تظاهر به پاک‌سازی خودکار بدتر از نبودنش بود:
 * جدول بی‌صدا رشد می‌کرد و کسی خبردار نمی‌شد.
 */
export async function DELETE(request: Request) {
  try {
    const rl = hit(`admin-system-prune:${clientIp(request)}`, {
      limit: 5,
      windowSeconds: 300,
      blockSeconds: 300,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    // پاک‌کردن ردّ خطا حساس‌تر از دیدنش است.
    const auth = await requirePlatformPermission("errors.view");
    if ("response" in auth) return auth.response;

    const parsed = await readJsonBody<{ days?: number }>(request);
    if ("response" in parsed) return parsed.response;

    // کف ۷ روز: پاک‌کردن خطاهای امروز یعنی نابودی همان چیزی که دنبالش هستیم.
    const days = boundedInt(parsed.data.days, 7, 365, 30);

    const { data, error } = await auth.svc.rpc("prune_platform_errors", { p_days: days });
    if (error) throw error;

    const removed = Number(data ?? 0);

    await auth.svc.rpc("log_platform_action", {
      p_action: "errors.prune",
      p_actor: auth.userId,
      p_target_type: "system",
      p_target_id: "platform_error_logs",
      p_target_name: `حذف خطاهای قدیمی‌تر از ${days} روز`,
      p_reason: null,
      p_meta: { days, removed },
      p_ip: requestIp(request),
    });

    return NextResponse.json({ ok: true, removed, days });
  } catch (error) {
    return safeError("admin/system:DELETE", error, 500, request);
  }
}
