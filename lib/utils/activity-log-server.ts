import { serviceClient } from "@/lib/security/api-guard";

/**
 * ثبت فعالیت از سمت سرور.
 *
 * چرا نسخه‌ی جدا از `activity-log.ts`؟
 *   آن فایل `"use client"` است و از کلاینت مرورگر استفاده می‌کند —
 *   در یک route handler قابل import نیست.
 *
 * ⚠️ `activity_logs.org_id` ستون `not null` دارد. برای رویدادهایی که
 * ذاتاً به کاربر مربوط‌اند (مثل تغییر رمز) و نه به یک سازمان خاص،
 * سازمان فعال کاربر پیدا و استفاده می‌شود. اگر کاربر هیچ عضویتی
 * نداشته باشد، لاگ بی‌صدا رد می‌شود — یک رویداد ثبت‌نشده بهتر از
 * شکستن عملیات اصلی است.
 */
export async function logActivityServer({
  userId,
  orgId,
  action,
  entityType,
  entityId,
  oldData,
  newData,
  ip,
  userAgent,
}: {
  userId: string | null;
  /** اگر داده نشود، از عضویت فعال کاربر استخراج می‌شود. */
  orgId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  try {
    const svc = serviceClient();

    let resolvedOrg = orgId ?? null;
    if (!resolvedOrg && userId) {
      const { data } = await svc
        .from("memberships")
        .select("org_id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      resolvedOrg = data?.org_id ?? null;
    }

    // بدون سازمان، درج به خاطر قید not null شکست می‌خورد.
    if (!resolvedOrg) return;

    await svc.from("activity_logs").insert({
      org_id: resolvedOrg,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      old_data: oldData ?? null,
      new_data: newData ?? null,
      ip_address: ip ?? null,
      user_agent: userAgent ?? null,
    });
  } catch {
    /*
      لاگ هرگز نباید عملیات اصلی را بشکند.

      اگر تغییر رمز موفق بود ولی ثبت لاگ شکست خورد، کاربر باید پیام
      موفقیت ببیند — نه خطایی که باعث شود دوباره تلاش کند در حالی که
      رمزش عوض شده.
    */
  }
}
