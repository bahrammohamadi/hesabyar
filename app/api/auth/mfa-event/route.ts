import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient, safeError } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * ثبت تلاش ناموفق مرحله‌ی دوم در سابقه‌ی ورود.
 *
 * چرا روت جدا؟ تأیید TOTP روی **کلاینت** انجام می‌شود (چون روی نشست
 * مرورگر کار می‌کند)، پس سرور از شکستش خبردار نمی‌شود مگر خودمان
 * بگوییم. بدون این، کاربری که کسی مدام کد اشتباه برایش می‌زند هیچ
 * ردی در سابقه نمی‌بیند — یعنی دقیقاً همان حمله‌ای که 2FA باید جلویش
 * را بگیرد، نامرئی می‌ماند.
 *
 * ⚠️ این روت هیچ تصمیمی نمی‌گیرد و چیزی را مجاز/غیرمجاز نمی‌کند؛
 * فقط ثبت می‌کند. پس حتی اگر کسی صدایش بزند، بدترین کارش شلوغ‌کردن
 * سابقه‌ی **خودش** است — و محدودیت نرخ همان را هم می‌گیرد.
 */
export async function POST(request: Request) {
  try {
    const rl = hit(`mfa-event:${clientIp(request)}`, { limit: 20, windowSeconds: 300 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const svc = serviceClient();
    await svc.rpc("record_login_event", {
      p_login_id: user.email ?? user.id,
      p_event: "mfa_failure",
      p_user_id: user.id,
      p_ip: clientIp(request),
      p_user_agent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return safeError("auth/mfa-event", error);
  }
}
