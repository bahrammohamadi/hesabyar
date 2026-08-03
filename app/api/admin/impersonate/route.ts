import { NextResponse } from "next/server";
import {
  requirePlatformPermission,
  safeError,
  isUuid,
  readJsonBody,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * ورود ادمین به‌جای کاربر.
 *
 * 🔴 حساس‌ترین روت پنل. چهار لایه‌ی دفاع:
 *   ۱. requirePlatformPermission("impersonate") — نقش
 *   ۲. سقف نرخ سخت‌گیرانه — این عمل نباید انبوه انجام شود
 *   ۳. تابع دیتابیس دوباره نقش را چک می‌کند (اگر این لایه دور زده شود)
 *   ۴. دلیل اجباری و لاگ خودکار با هویت واقعی ادمین
 */

export async function GET(request: Request) {
  try {
    const auth = await requirePlatformPermission("impersonate");
    if ("response" in auth) return auth.response;

    const { data, error } = await auth.svc.rpc("active_impersonation", {
      p_actor: auth.userId,
    });
    if (error) throw error;

    // تابع مجموعه برمی‌گرداند؛ صفر ردیف یعنی جلسه‌ی فعالی نیست.
    const session = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return NextResponse.json({ session });
  } catch (e) {
    return safeError("admin/impersonate:GET", e);
  }
}

export async function POST(request: Request) {
  try {
    const rl = hit(`imp-start:${clientIp(request)}`, {
      limit: 10,
      windowSeconds: 300,
      blockSeconds: 900,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformPermission("impersonate");
    if ("response" in auth) return auth.response;

    const parsed = await readJsonBody<{ target?: string; reason?: string }>(request);
    if ("response" in parsed) return parsed.response;

    const { target } = parsed.data;
    const reason = typeof parsed.data.reason === "string" ? parsed.data.reason.trim().slice(0, 500) : "";

    if (!isUuid(target)) {
      return NextResponse.json({ error: "شناسه‌ی کاربر نامعتبر است" }, { status: 400 });
    }
    // دلیل کوتاه بی‌فایده است؛ «تست» چیزی را توضیح نمی‌دهد.
    if (reason.length < 5) {
      return NextResponse.json(
        { error: "دلیل ورود را بنویسید (حداقل ۵ نویسه)" },
        { status: 400 }
      );
    }

    const { data, error } = await auth.svc.rpc("start_impersonation", {
      p_target: target,
      p_reason: reason,
      p_actor: auth.userId,
      p_ip: clientIp(request),
    });
    if (error) {
      // پیام‌های تابع فارسی و قابل نمایش‌اند (دسترسی، ادمین دیگر، …)
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json({ ok: true, session_id: data });
  } catch (e) {
    return safeError("admin/impersonate:POST", e);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requirePlatformPermission("impersonate");
    if ("response" in auth) return auth.response;

    const { data, error } = await auth.svc.rpc("end_impersonation", {
      p_session: null,
      p_actor: auth.userId,
      p_reason: "پایان دستی",
    });
    if (error) throw error;

    return NextResponse.json({ ok: true, ended: data ?? 0 });
  } catch (e) {
    return safeError("admin/impersonate:DELETE", e);
  }
}
