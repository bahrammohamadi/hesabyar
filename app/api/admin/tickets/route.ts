import { NextResponse } from "next/server";
import {
  requirePlatformPermission,
  safeError,
  boundedInt,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import {
  TICKET_STATUSES, TICKET_PRIORITIES, TICKET_CATEGORIES,
  mapTicketRow, averageFirstResponseHours,
} from "@/lib/support/tickets";

export const dynamic = "force-dynamic";

/**
 * صف تیکت‌ها برای تیم پشتیبانی.
 *
 * چرا `tickets.view` و نه `orgs.view`؟
 *   محتوای تیکت داده‌ی خام مشتری است: اسکرین‌شات مبلغ فروش، نام
 *   مشتریانش، شرح مشکل مالی. این از دیدن «فهرست کسب‌وکارها» حساس‌تر
 *   است و باید بشود نقشی ساخت که یکی را ببیند و دیگری را نه.
 */
export async function GET(request: Request) {
  try {
    const rl = hit(`admin-tickets:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformPermission("tickets.view");
    if ("response" in auth) return auth.response;

    const url = new URL(request.url);
    const limit = boundedInt(url.searchParams.get("limit"), 10, 200, 100);

    let query = auth.svc.from("v_support_tickets").select("*");

    /*
      فیلترها از فهرست سفید می‌آیند.
      رشته‌ی دلخواه در .eq() تزریق SQL نمی‌کند، ولی مقدار بی‌معنا
      نتیجه‌ی خالی می‌دهد و کاربر فکر می‌کند تیکتی نیست.
    */
    const status = url.searchParams.get("status");
    if (status && (TICKET_STATUSES as readonly string[]).includes(status)) {
      query = query.eq("status", status);
    } else if (status === "unresolved") {
      // پیش‌فرض کارِ روزمره: هرچه هنوز تمام نشده.
      query = query.in("status", ["open", "pending"]);
    }

    const priority = url.searchParams.get("priority");
    if (priority && (TICKET_PRIORITIES as readonly string[]).includes(priority)) {
      query = query.eq("priority", priority);
    }

    const category = url.searchParams.get("category");
    if (category && (TICKET_CATEGORIES as readonly string[]).includes(category)) {
      query = query.eq("category", category);
    }

    const { data, error } = await query
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;

    const rows = (data ?? []).map(mapTicketRow);

    /*
      شمارنده‌های بالای صفحه از *کل* تیکت‌ها محاسبه می‌شوند، نه از
      نتیجه‌ی فیلترشده. وگرنه با فیلتر «فوری»، عدد «تیکت باز» هم
      عوض می‌شد و بی‌معنا به نظر می‌رسید.
    */
    const { data: allRows } = await auth.svc
      .from("v_support_tickets")
      .select("status, priority, unread_for_staff, first_response_at, created_at");

    const summary = {
      total: allRows?.length ?? 0,
      open: (allRows ?? []).filter((r) => r.status === "open").length,
      pending: (allRows ?? []).filter((r) => r.status === "pending").length,
      unread: (allRows ?? []).filter((r) => r.unread_for_staff === true).length,
      high: (allRows ?? []).filter(
        (r) => r.priority === "high" && ["open", "pending"].includes(String(r.status))
      ).length,
      /*
        میانگین زمان اولین پاسخ (ساعت).

        فقط تیکت‌هایی که *پاسخ گرفته‌اند* شمرده می‌شوند. اضافه‌کردن
        تیکت‌های بی‌پاسخ با عدد صفر، میانگین را بهتر از واقعیت نشان
        می‌دهد — دقیقاً برعکس چیزی که باید ببینیم.
      */
      avgFirstResponseHours: averageFirstResponseHours(allRows ?? []),
    };

    return NextResponse.json({ tickets: rows, summary, viewerRole: auth.role });
  } catch (error) {
    return safeError("admin/tickets:GET", error);
  }
}
