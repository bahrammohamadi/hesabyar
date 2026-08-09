import { NextResponse } from "next/server";
import {
  requirePlatformPermission,
  safeError,
  boundedInt,
  isUuid,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { applyRange } from "@/src/shared/ui/date-range-utils";
import { INVOICE_STATUSES } from "@/lib/admin/invoices";

export const dynamic = "force-dynamic";

/**
 * فاکتورهای همه‌ی کسب‌وکارها — پنل سوپرادمین.
 *
 * چرا `invoice.view` و نه `orgs.view`؟
 *   فهرست کسب‌وکارها فقط می‌گوید «چه کسی مشتری ماست». فاکتور، داده‌ی
 *   خام تجاری مشتری است: چه فروخته، به چه کسی، به چه قیمتی، با چه
 *   شماره تلفنی. این حساس‌ترین چیزی است که در سیستم داریم و باید
 *   بشود نقشی ساخت که کسب‌وکارها را ببیند ولی فاکتورهایشان را نه.
 *
 *   این مجوز از مهاجرت ۰۰۲۸ در ماتریس بود ولی هیچ روتی از آن استفاده
 *   نمی‌کرد — یک مجوز مرده. حالا معنا پیدا می‌کند.
 */
export async function GET(request: Request) {
  try {
    const rl = hit(`admin-invoices:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformPermission("invoice.view");
    if ("response" in auth) return auth.response;

    const url = new URL(request.url);
    const limit = boundedInt(url.searchParams.get("limit"), 10, 200, 50);

    let query = auth.svc.from("v_admin_invoices").select("*");

    // فیلتر کسب‌وکار — فقط UUID معتبر، وگرنه فیلتر نادیده گرفته می‌شود.
    const orgId = url.searchParams.get("org");
    if (orgId && isUuid(orgId)) query = query.eq("org_id", orgId);

    const status = url.searchParams.get("status");
    if (status && (INVOICE_STATUSES as readonly string[]).includes(status)) {
      query = query.eq("status", status);
    }

    /*
      جستجو روی ستون یکپارچه‌ی search_blob (شماره فاکتور، نام
      کسب‌وکار، نام و تلفن مشتری) که در نما با lower() ساخته می‌شود.

      ⚠️ کاراکترهای % و _ و , از ورودی حذف می‌شوند: در الگوی LIKE
      معنای ویژه دارند و «%» تنها، کل جدول را برمی‌گرداند. کاما هم
      نحو فیلتر PostgREST را می‌شکند.
    */
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 80);
    if (q) {
      const safe = q.replace(/[%_,()]/g, " ").trim();
      if (safe) query = query.ilike("search_blob", `%${safe}%`);
    }

    /*
      بازه‌ی تاریخ — از همان helper مشترکی که بقیه‌ی گزارش‌ها استفاده
      می‌کنند، نه منطق دست‌ساز.

      🔴 `sales.date` از نوع timestamptz است نه date. با `lte(to)`
      فاکتورهای خودِ روز پایانی (که ساعت غیرصفر دارند) از قلم
      می‌افتادند؛ rangeBounds به `lt(روز بعد)` تبدیل می‌کند.
    */
    const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
    const rawFrom = url.searchParams.get("from") ?? "";
    const rawTo = url.searchParams.get("to") ?? "";
    const range = {
      from: ISO_DAY.test(rawFrom) ? rawFrom : "",
      to: ISO_DAY.test(rawTo) ? rawTo : "",
    };
    query = applyRange(query, "date", range);

    const { data, error } = await query
      .order("date", { ascending: false })
      .limit(limit);
    if (error) throw error;

    const rows = data ?? [];

    /*
      خلاصه از همین نتیجه‌ی فیلترشده محاسبه می‌شود، نه از کل جدول.

      اینجا عمداً برعکس صفحه‌ی تیکت‌هاست: آنجا شمارنده‌ها وضعیت کلی صف
      را نشان می‌دهند، ولی اینجا کاربر یک بازه یا یک کسب‌وکار را انتخاب
      کرده و می‌خواهد بداند «جمع همین‌ها چقدر است».
    */
    const summary = {
      count: rows.length,
      totalAmount: rows.reduce(
        (sum, r) => sum + (r.status === "cancelled" ? 0 : Number(r.total ?? 0)),
        0
      ),
      cancelled: rows.filter((r) => r.status === "cancelled").length,
      // آیا نتیجه به سقف خورده؟ بدون این، کاربر فکر می‌کند همه را می‌بیند.
      truncated: rows.length >= limit,
    };

    return NextResponse.json({ invoices: rows, summary, viewerRole: auth.role });
  } catch (error) {
    return safeError("admin/invoices:GET", error, 500, request);
  }
}
