import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeError, readJsonBody } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * بازنشانی ورود دومرحله‌ای یک کاربر توسط مالک یا مدیر مجموعه.
 *
 * 🔴 حفره‌ای که می‌بندد: اگر کاربر گوشی **و** کدهای پشتیبانش را با
 * هم گم کند، هیچ راه خودکاری برای بازگشت نبود. کد بازیابی رمز هم
 * کمکی نمی‌کرد چون فقط رمز را عوض می‌کند و عامل دوم سر جایش
 * می‌ماند — کاربر رمز تازه دارد ولی همچنان پشت صفحه‌ی تأیید گیر
 * است.
 *
 * ⚠️ کلاینت درخواست‌محور استفاده می‌شود نه `service_role`.
 *   تابع `admin_reset_user_mfa` نقش را با `auth.uid()` می‌سنجد؛ با
 *   کلید سرویس آن تهی است و تابع خطا می‌دهد. این خودش یک لایه‌ی
 *   محافظت است: حتی اشتباه در این روت هم نمی‌تواند گارد نقش را دور
 *   بزند.
 */
export async function POST(request: Request) {
  try {
    /*
      محدودیت نرخ سختگیرانه. این عملیات محافظت یک حساب را برمی‌دارد،
      پس نباید بشود پشت سر هم روی چند کاربر اجرایش کرد.
    */
    const rl = hit(`admin-reset-mfa:${clientIp(request)}`, {
      limit: 5,
      windowSeconds: 900,
      blockSeconds: 900,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const parsed = await readJsonBody<Record<string, unknown>>(request);
    if ("response" in parsed) return parsed.response;

    const userId = String(parsed.data.user_id ?? "").trim();
    if (!userId) {
      return NextResponse.json({ error: "کاربر مشخص نشده است." }, { status: 400 });
    }

    const supabase = createClient();
    const { data, error } = await supabase.rpc("admin_reset_user_mfa", { p_user_id: userId });

    if (error) {
      // پیام‌های تابع فارسی و قابل نمایش‌اند (نقش ناکافی، حساب خودی).
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const result = data as { factors_removed?: number; codes_removed?: number };
    return NextResponse.json({
      ok: true,
      factorsRemoved: Number(result?.factors_removed ?? 0),
      codesRemoved: Number(result?.codes_removed ?? 0),
    });
  } catch (error) {
    return safeError("admin/reset-mfa", error);
  }
}
