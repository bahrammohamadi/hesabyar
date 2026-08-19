import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient, safeError, readJsonBody } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import {
  generateResetCode,
  hashResetCode,
  isWellFormedCode,
  normalizeCodeInput,
  RESET_FAILURE_MESSAGES,
} from "@/lib/security/recovery";
import { firstPasswordError } from "@/lib/security/password";

export const dynamic = "force-dynamic";

/**
 * فلفل (pepper) برای هش کد.
 *
 * ⚠️ اگر متغیر محیطی تنظیم نشده باشد، از کلید سرویس مشتق می‌شود.
 * این ایده‌آل نیست ولی از fallback ثابتِ درون کد بسیار بهتر است:
 * کلید سرویس در مخزن نیست و بین نصب‌ها فرق می‌کند.
 */
function pepper(): string {
  return (
    process.env.RESET_CODE_PEPPER ??
    process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-32) ??
    "tarazoo-reset"
  );
}

/**
 * POST — صدور کد بازیابی توسط مالک یا مدیر مجموعه.
 *
 * 🔴 چرا مدیر مستقیم رمز را عوض نکند؟
 *   می‌تواند (روت admin/users/password هست). ولی آن‌وقت مدیر رمز
 *   کاربر را **می‌داند** و می‌تواند بعداً به‌جای او سند مالی ثبت
 *   کند؛ انکارناپذیری از بین می‌رود. با کد یک‌بارمصرف، رمز نهایی
 *   را فقط خود کاربر می‌داند.
 *
 * ⚠️ کد فقط **یک بار** و در همین پاسخ برگردانده می‌شود. در دیتابیس
 * هش ذخیره می‌شود، پس بازیابی‌اش ممکن نیست.
 */
export async function POST(request: Request) {
  try {
    const rl = hit(`reset-code-issue:${clientIp(request)}`, {
      limit: 20,
      windowSeconds: 3600,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const parsed = await readJsonBody<Record<string, unknown>>(request);
    if ("response" in parsed) return parsed.response;

    const targetUserId = String(parsed.data.user_id ?? "").trim();
    if (!targetUserId) {
      return NextResponse.json({ error: "کاربر مشخص نشده است." }, { status: 400 });
    }

    /*
      کلاینت درخواست‌محور استفاده می‌شود، نه service_role.

      دلیل: تابع `issue_password_reset_code` نقش کاربر را با
      `auth.uid()` می‌سنجد. با کلید سرویس، `auth.uid()` تهی است و
      گارد نقش دور زده می‌شود.
    */
    const supabase = createClient();
    const code = generateResetCode();

    const { data, error } = await supabase.rpc("issue_password_reset_code", {
      p_user_id: targetUserId,
      p_code_hash: hashResetCode(code, pepper()),
      p_ttl_minutes: 30,
    });

    if (error) {
      // پیام‌های تابع فارسی و قابل نمایش‌اند (نقش ناکافی، کاربر غیرعضو).
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      // 🔴 تنها جایی که کد خام دیده می‌شود.
      code,
      expires_in_minutes: (data as { expires_in_minutes?: number })?.expires_in_minutes ?? 30,
    });
  } catch (error) {
    return safeError("auth/reset-code:issue", error);
  }
}

/**
 * PUT — مصرف کد و تعیین رمز جدید توسط خود کاربر.
 *
 * این مسیر **بدون ورود** قابل استفاده است (کاربر رمزش را ندارد)،
 * پس محدودیت نرخ و سقف تلاش تنها محافظ‌ها هستند.
 */
export async function PUT(request: Request) {
  try {
    const rl = hit(`reset-code-use:${clientIp(request)}`, {
      limit: 10,
      windowSeconds: 900,
      blockSeconds: 900,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const parsed = await readJsonBody<Record<string, unknown>>(request);
    if ("response" in parsed) return parsed.response;

    const loginId = String(parsed.data.login_id ?? "").trim().toLowerCase();
    const rawCode = String(parsed.data.code ?? "");
    const newPassword = String(parsed.data.password ?? "");

    if (!loginId || !rawCode || !newPassword) {
      return NextResponse.json({ error: "همه‌ی فیلدها الزامی است." }, { status: 400 });
    }

    /*
      شکل کد پیش از تماس با دیتابیس بررسی می‌شود.

      ⚠️ مهم: ورودی آشکارا غلط (مثلاً ۵ رقم) نباید سهمیه‌ی ۵ تلاش
      کاربر را بسوزاند. آن سهمیه برای حدس‌های واقعی است.
    */
    const code = normalizeCodeInput(rawCode);
    if (!isWellFormedCode(code)) {
      return NextResponse.json({ error: RESET_FAILURE_MESSAGES.invalid }, { status: 400 });
    }

    /*
      🔴 سیاست رمز **سمت سرور** اعمال می‌شود.
      هر چیزی که فقط در مرورگر چک شود با یک درخواست مستقیم دور
      زده می‌شود — و این مسیر اصلاً نیاز به ورود ندارد.
    */
    const passwordProblem = firstPasswordError(newPassword);
    if (passwordProblem) {
      return NextResponse.json({ error: passwordProblem }, { status: 400 });
    }

    const svc = serviceClient();
    const { data, error } = await svc.rpc("consume_password_reset_code", {
      p_login_id: loginId,
      p_code_hash: hashResetCode(code, pepper()),
    });

    if (error) {
      return safeError("auth/reset-code:consume", error);
    }

    const result = data as { ok?: boolean; reason?: string; user_id?: string };
    if (!result?.ok) {
      const reason = result?.reason ?? "invalid";
      return NextResponse.json(
        { error: RESET_FAILURE_MESSAGES[reason] ?? RESET_FAILURE_MESSAGES.invalid },
        { status: 400 }
      );
    }

    /*
      تغییر رمز با Admin API انجام می‌شود نه با دستکاری مستقیم
      auth.users: هش رمز آنجاست و نوشتن مستقیمش شکننده است.
    */
    const { error: updateError } = await svc.auth.admin.updateUserById(result.user_id!, {
      password: newPassword,
    });
    if (updateError) {
      return safeError("auth/reset-code:update", updateError);
    }

    /*
      🔴 شمارنده‌ی کندسازی پاک می‌شود.
      وگرنه کاربری که تازه رمزش را عوض کرده، با اولین اشتباه تایپی
      بلافاصله به همان سطح تأخیر قبلی برمی‌گردد.
    */
    

    await svc.rpc("clear_login_failures", { p_login_id: loginId });

    try {
      await svc.rpc("record_login_event", {
        p_login_id: loginId,
        p_event: "reset",
        p_user_id: result.user_id,
        p_ip: clientIp(request),
        p_user_agent: request.headers.get("user-agent"),
      });
    } catch {
      // ثبت سابقه نباید مسیر را بشکند.
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return safeError("auth/reset-code:put", error);
  }
}
