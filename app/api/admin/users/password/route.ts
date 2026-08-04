import { NextResponse } from "next/server";
import {
  requirePlatformPermission,
  safeError,
  readJsonBody,
  requestIp,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { firstPasswordError } from "@/lib/security/password";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * بازنشانی رمز عبور یک کاربر توسط سوپرادمین.
 *
 * چرا فقط super_admin؟
 *   عوض کردن رمز یعنی «توانایی ورود به جای کاربر» — دسترسی کامل و
 *   بی‌سروصدا به داده‌ی کسب‌وکار مشتری. نقش support برای دیدن مشکل،
 *   امکان جعل هویت دارد که پایان‌دار و کاملاً لاگ‌شده است.
 *
 * محافظت‌های اعمال‌شده:
 *   ۱. مجوز اختصاصی `users.password` (فقط super_admin)
 *   ۲. دلیل اجباری با حداقل طول — همان الگوی جعل هویت
 *   ۳. ادمین نمی‌تواند رمز ادمین دیگری را عوض کند
 *   ۴. ثبت کامل در گزارش ممیزی، پیش از خودِ تغییر
 *   ۵. همان قواعد رمز که برای کاربران عادی اعمال می‌شود
 */
export async function POST(request: Request) {
  try {
    const rl = hit(`admin-password:${clientIp(request)}`, { limit: 10, windowSeconds: 300 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformPermission("users.password");
    if ("response" in auth) return auth.response;
    const { userId: actorId, svc } = auth;

    const parsed = await readJsonBody<Record<string, unknown>>(request);
    if ("response" in parsed) return parsed.response;

    const targetUserId = String(parsed.data.user_id ?? "");
    const newPassword = String(parsed.data.new_password ?? "");
    const reason = String(parsed.data.reason ?? "").trim();

    if (!UUID_RE.test(targetUserId)) {
      return NextResponse.json({ error: "شناسه کاربر نامعتبر است." }, { status: 400 });
    }

    /*
      دلیل اجباری — همان قاعده‌ی جعل هویت.

      این فقط یک فیلد فرم نیست: بدون دلیل، گزارش ممیزی می‌گوید «رمز
      عوض شد» ولی نمی‌گوید چرا، و در بازبینی امنیتی بی‌فایده است.
    */
    if (reason.length < 5) {
      return NextResponse.json(
        { error: "دلیل بازنشانی رمز الزامی است (حداقل ۵ نویسه)." },
        { status: 400 }
      );
    }

    const validationError = firstPasswordError(newPassword);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (targetUserId === actorId) {
      /*
        ادمین باید رمز خودش را از مسیر عادی عوض کند، جایی که رمز فعلی
        پرسیده می‌شود. اجازه دادن اینجا یعنی دور زدن آن بررسی.
      */
      return NextResponse.json(
        { error: "برای تغییر رمز خودتان از تنظیمات حساب استفاده کنید." },
        { status: 400 }
      );
    }

    /*
      🔴 ادمین نمی‌تواند رمز ادمین دیگری را عوض کند.

      بدون این، یک super_admin می‌توانست حساب بقیه‌ی ادمین‌ها را
      تصاحب کند و عملاً آن‌ها را از پلتفرم بیرون بیندازد.
    */
    const { data: targetAdmin } = await svc
      .from("platform_admins")
      .select("user_id, role")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (targetAdmin) {
      return NextResponse.json(
        { error: "رمز ادمین‌های پلتفرم از این مسیر قابل تغییر نیست." },
        { status: 403 }
      );
    }

    const { data: targetUser, error: fetchError } = await svc.auth.admin.getUserById(targetUserId);
    if (fetchError || !targetUser.user) {
      return NextResponse.json({ error: "کاربر یافت نشد." }, { status: 404 });
    }

    /*
      ثبت ممیزی *پیش از* انجام تغییر.

      اگر بعد از تغییر لاگ می‌کردیم و درج لاگ شکست می‌خورد، یک تغییر
      رمز ثبت‌نشده باقی می‌ماند — دقیقاً همان چیزی که ممیزی باید جلویش
      را بگیرد.
    */
    await svc.rpc("log_platform_action", {
      p_action: "user.password_reset",
      p_actor: actorId,
      p_target_type: "user",
      p_target_id: targetUserId,
      p_target_name: targetUser.user.email ?? null,
      p_reason: reason,
      p_meta: {},
      p_ip: requestIp(request),
    });

    const { error: updateError } = await svc.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, email: targetUser.user.email });
  } catch (error) {
    return safeError("admin/users/password", error);
  }
}
