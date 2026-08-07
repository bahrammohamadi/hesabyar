import { NextResponse } from "next/server";
import {
  requirePlatformPermission,
  safeError,
  isUuid,
  readJsonBody,
  requestIp,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { normalizeIranMobile } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

/**
 * ویرایش نام و شماره‌ی یک کاربر توسط ادمین پلتفرم.
 *
 * چرا لازم است: پشتیبانی مرتب با «اسمم اشتباه ثبت شده» روبه‌رو می‌شود
 * و تا امروز تنها راه، دست‌کاری دستی دیتابیس بود.
 *
 * ⚠️ چرا مجوز `users.password` و نه `users.view`؟
 *   عوض‌کردن نام نمایشی یعنی تغییر هویتی که بقیه می‌بینند. با
 *   `users.view` هر ادمینِ فقط‌خواننده می‌توانست نام کاربران را عوض
 *   کند. این کار از جنس «تغییر حساب» است، نه «دیدن».
 */
export async function PATCH(request: Request) {
  try {
    const rl = hit(`admin-profile:${clientIp(request)}`, { limit: 30, windowSeconds: 600 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformPermission("users.password");
    if ("response" in auth) return auth.response;

    const parsed = await readJsonBody<{
      user_id?: string;
      full_name?: string;
      phone?: string;
      reason?: string;
    }>(request);
    if ("response" in parsed) return parsed.response;

    const userId = parsed.data.user_id;
    if (!isUuid(userId)) {
      return NextResponse.json({ error: "شناسه‌ی کاربر نامعتبر است" }, { status: 400 });
    }

    /*
      دلیل اجباری — همان قاعده‌ی بازنشانی رمز.
      تغییر داده‌ی حساب مشتری بدون توضیح، در ممیزی غیرقابل‌دفاع است.
    */
    const reason = String(parsed.data.reason ?? "").trim();
    if (reason.length < 5) {
      return NextResponse.json(
        { error: "دلیل تغییر را بنویسید (حداقل ۵ نویسه)" },
        { status: 400 }
      );
    }

    const fullName = String(parsed.data.full_name ?? "").trim();
    if (fullName.length < 2 || fullName.length > 100) {
      return NextResponse.json({ error: "نام معتبر نیست" }, { status: 400 });
    }

    const rawPhone = String(parsed.data.phone ?? "").trim();
    let phone: string | null = null;
    if (rawPhone) {
      phone = normalizeIranMobile(rawPhone);
      if (!phone) {
        return NextResponse.json({ error: "شماره موبایل معتبر نیست" }, { status: 400 });
      }
    }

    const { data: target } = await auth.svc.auth.admin.getUserById(userId);
    if (!target.user) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }
    const before = (target.user.user_metadata?.name as string | undefined) ?? null;

    const { error: authErr } = await auth.svc.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...(target.user.user_metadata ?? {}),
        name: fullName,
        ...(phone ? { phone } : {}),
      },
    });
    if (authErr) throw authErr;

    // سازمانی که این کاربر مالکش است — شرط owner_id جلوی نشت به
    // سازمان‌های دیگر را می‌گیرد.
    await auth.svc
      .from("organizations")
      .update({
        owner_full_name: fullName,
        ...(phone ? { owner_phone: phone } : {}),
      })
      .eq("owner_id", userId);

    await auth.svc.rpc("log_platform_action", {
      p_action: "user.profile_updated",
      p_actor: auth.userId,
      p_target_type: "user",
      p_target_id: userId,
      p_target_name: target.user.email ?? null,
      p_reason: reason.slice(0, 500),
      p_meta: { from: before, to: fullName, phone_changed: Boolean(phone) },
      p_ip: requestIp(request),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return safeError("admin/users/profile:PATCH", error);
  }
}
