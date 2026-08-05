import { NextResponse } from "next/server";
import { requirePlatformPermission, safeError } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * آمار مصرف کسب‌وکارها.
 *
 * چرا `orgs.view` و نه مجوز جدید؟
 *   این داده همان چیزی است که در فهرست کسب‌وکارها دیده می‌شود، فقط
 *   جمع‌بندی‌شده. افزودن مجوز تازه یعنی هر ادمین موجود باید دستی
 *   به‌روزرسانی شود، بدون اینکه سطح دسترسی واقعی عوض شده باشد.
 */
export async function GET(request: Request) {
  try {
    const rl = hit(`admin-usage:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformPermission("orgs.view");
    if ("response" in auth) return auth.response;

    const { data, error } = await auth.svc
      .from("v_org_usage")
      .select("*")
      .order("last_activity_at", { ascending: false });

    if (error) throw error;

    const now = Date.now();
    const rows = (data ?? []).map((r: Record<string, unknown>) => {
      const lastActivity = r.last_activity_at as string | null;
      const daysIdle = lastActivity
        ? Math.floor((now - new Date(lastActivity).getTime()) / 86_400_000)
        : null;

      return {
        orgId: r.org_id as string,
        orgName: (r.org_name as string) ?? "—",
        approvalStatus: (r.approval_status as string) ?? null,
        businessType: (r.business_type as string) ?? null,
        ownerName: (r.owner_full_name as string) ?? null,
        createdAt: r.org_created_at as string,
        trialEndsAt: (r.trial_ends_at as string) ?? null,
        users: Number(r.users_count ?? 0),
        products: Number(r.products_count ?? 0),
        variants: Number(r.variants_count ?? 0),
        contacts: Number(r.contacts_count ?? 0),
        sales: Number(r.sales_count ?? 0),
        purchases: Number(r.purchases_count ?? 0),
        transactions: Number(r.transactions_count ?? 0),
        movements: Number(r.movements_count ?? 0),
        sales30d: Number(r.sales_30d ?? 0),
        revenue30d: Number(r.revenue_30d ?? 0),
        lastActivityAt: lastActivity,
        lastLoginAt: (r.last_login_at as string) ?? null,
        daysIdle,
        /*
          وضعیت سلامت.

          آستانه‌ها بر اساس رفتار خرده‌فروشی انتخاب شده‌اند: یک مغازه‌ی
          فعال تقریباً هر روز فاکتور می‌زند. دو هفته سکوت یعنی چیزی
          درست نیست؛ یک ماه یعنی احتمالاً رفته.

          خودِ سازمان‌های تازه (کمتر از ۷ روز) هرگز «رهاشده» علامت
          نمی‌خورند — هنوز فرصت شروع نداشته‌اند.
        */
        health: computeHealth(
          daysIdle,
          Number(r.sales_30d ?? 0),
          r.org_created_at as string,
          now
        ),
      };
    });

    return NextResponse.json({ orgs: rows });
  } catch (error) {
    return safeError("admin/usage", error);
  }
}

type Health = "active" | "quiet" | "idle" | "new" | "empty";

function computeHealth(
  daysIdle: number | null,
  sales30d: number,
  createdAt: string,
  now: number
): Health {
  const ageDays = Math.floor((now - new Date(createdAt).getTime()) / 86_400_000);
  if (ageDays < 7) return "new";
  if (sales30d > 0) return "active";
  // بدون هیچ فعالیتی از ابتدا — یعنی اصلاً شروع نکرده.
  if (daysIdle !== null && daysIdle >= ageDays - 1) return "empty";
  if (daysIdle !== null && daysIdle >= 30) return "idle";
  return "quiet";
}
