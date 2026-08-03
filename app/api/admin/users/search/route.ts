import { NextResponse } from "next/server";
import { requirePlatformPermission, safeError, boundedInt } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * جستجوی کاربران در سطح پلتفرم.
 *
 * خواسته‌ی صریح: «جستجوی کاربر با روش‌های مختلف».
 * نمای v_admin_users یک ستون search_blob دارد که ایمیل، نام
 * کسب‌وکار، نام مالک و شماره تماس را یک‌جا نگه می‌دارد، پس یک عبارت
 * همه را پوشش می‌دهد.
 */
export async function GET(request: Request) {
  try {
    const rl = hit(`admin-usearch:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformPermission("users.view");
    if ("response" in auth) return auth.response;

    const url = new URL(request.url);
    const term = (url.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 80);
    const limit = boundedInt(url.searchParams.get("limit"), 1, 100, 30);
    const status = url.searchParams.get("status") ?? "";

    let query = auth.svc
      .from("v_admin_users")
      .select(
        "user_id, email, joined_at, last_sign_in_at, email_verified, org_id, org_name," +
          " approval_status, owner_full_name, owner_phone, business_type, trial_ends_at," +
          " member_role, platform_role"
      )
      .order("joined_at", { ascending: false })
      .limit(limit);

    if (term) {
      /*
        ارقام فارسی به لاتین تبدیل می‌شوند تا جستجوی شماره تماس با
        «۰۹۱۲» هم نتیجه بدهد. بدون این، کاربر فارسی‌نویس هیچ‌وقت
        شماره‌ای پیدا نمی‌کرد.
      */
      const FA = "۰۱۲۳۴۵۶۷۸۹";
      const normalized = term.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)));
      // ویژه‌کاراکترهای الگوی LIKE خنثی می‌شوند
      const safe = normalized.replace(/[%_,]/g, " ").trim();
      if (safe) query = query.ilike("search_blob", `%${safe}%`);
    }

    if (status && ["pending", "approved", "rejected", "suspended"].includes(status)) {
      query = query.eq("approval_status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ users: data ?? [] });
  } catch (e) {
    return safeError("admin/users/search:GET", e);
  }
}
