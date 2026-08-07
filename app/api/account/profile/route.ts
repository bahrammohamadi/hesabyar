import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient, safeError, readJsonBody } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { normalizeIranMobile } from "@/lib/utils/format";
import { logActivityServer } from "@/lib/utils/activity-log-server";

export const dynamic = "force-dynamic";

/**
 * ویرایش نام و شماره‌ی خودِ کاربر.
 *
 * 🔴 چرا لازم شد: تا امروز نام کاربر فقط *نمایش* داده می‌شد. کسی که
 * نامش را اشتباه وارد کرده بود یا شماره‌اش عوض شده بود، هیچ راهی جز
 * تماس با پشتیبانی نداشت — همان الگویی که برای تغییر رمز هم وجود
 * داشت و رفع شد.
 *
 * ⚠️ نام در **دو جا** ذخیره می‌شود و هر دو باید به‌روز شوند:
 *   • `auth.users.user_metadata.name` — برای حساب‌هایی که ادمین ساخته
 *   • `organizations.owner_full_name` — برای ثبت‌نام‌های خودکار
 * هدر از هر دو می‌خواند (درس مهاجرت هدر). اگر فقط یکی به‌روز شود،
 * کاربر نام قدیمی را جایی می‌بیند و فکر می‌کند ذخیره نشده.
 */

const MAX_NAME = 100;

export async function GET() {
  try {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const svc = serviceClient();
    const { data: org } = await svc
      .from("organizations")
      .select("id, name, owner_full_name, owner_phone")
      .eq("owner_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      // اولویت با متادیتای حساب؛ اگر نبود، نام مالک سازمان.
      fullName: (user.user_metadata?.name as string | undefined) ?? org?.owner_full_name ?? "",
      phone: (user.user_metadata?.phone as string | undefined) ?? org?.owner_phone ?? "",
      email: user.email ?? "",
      orgName: org?.name ?? null,
      isOwner: Boolean(org),
    });
  } catch (error) {
    return safeError("account/profile:GET", error);
  }
}

export async function PATCH(request: Request) {
  try {
    const rl = hit(`profile-update:${clientIp(request)}`, { limit: 20, windowSeconds: 600 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const parsed = await readJsonBody<{ full_name?: string; phone?: string }>(request);
    if ("response" in parsed) return parsed.response;

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const fullName = String(parsed.data.full_name ?? "").trim();
    if (fullName.length < 2) {
      return NextResponse.json({ error: "نام را کامل بنویسید (حداقل ۲ نویسه)." }, { status: 400 });
    }
    if (fullName.length > MAX_NAME) {
      return NextResponse.json({ error: "نام بیش از حد طولانی است." }, { status: 400 });
    }

    /*
      شماره اختیاری است، ولی اگر داده شد باید معتبر باشد.
      یکدست‌سازی لازم است وگرنه «۰۹۱۲…» و «+98912…» دو مقدار متفاوت
      ذخیره می‌شوند و جستجوی پشتیبانی یکی را پیدا نمی‌کند.
    */
    const rawPhone = String(parsed.data.phone ?? "").trim();
    let phone: string | null = null;
    if (rawPhone) {
      phone = normalizeIranMobile(rawPhone);
      if (!phone) {
        return NextResponse.json(
          { error: "شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)." },
          { status: 400 }
        );
      }
    }

    const svc = serviceClient();

    // ۱) متادیتای حساب
    const { error: authErr } = await svc.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata ?? {}),
        name: fullName,
        ...(phone ? { phone } : {}),
      },
    });
    if (authErr) throw authErr;

    /*
      ۲) سازمانی که این کاربر مالکش است.

      🔴 شرط `owner_id` حیاتی است. بدون آن، یک به‌روزرسانی بدون فیلتر
      نام مالک *همه‌ی* سازمان‌ها را عوض می‌کرد — همان اشتباهی که یک بار
      در هدر رخ داد و نام یک کسب‌وکار در حساب دیگری دیده شد.
    */
    const { error: orgErr } = await svc
      .from("organizations")
      .update({
        owner_full_name: fullName,
        ...(phone ? { owner_phone: phone } : {}),
      })
      .eq("owner_id", user.id);
    if (orgErr) throw orgErr;

    await logActivityServer({
      userId: user.id,
      action: "update",
      entityType: "user",
      entityId: user.id,
      newData: { full_name: fullName, phone_changed: Boolean(phone) },
    });

    return NextResponse.json({ ok: true, fullName, phone });
  } catch (error) {
    return safeError("account/profile:PATCH", error);
  }
}
