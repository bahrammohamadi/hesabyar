import { NextResponse } from "next/server";
import {
  requireMember,
  serviceClient,
  safeError,
  safeDate,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  try {
    // گزارش سنگین است (تا ۵۰۰۰ ردیف + چند فراخوانی Auth) → سقف پایین‌تر.
    const rl = hit(`reports-sellers:${clientIp(request)}`, {
      limit: 20,
      windowSeconds: 60,
      blockSeconds: 120,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const url = new URL(request.url);
    const auth = await requireMember(url.searchParams.get("org_id"), "reports.view");
    if ("response" in auth) return auth.response;
    const { membership } = auth.ctx;

    // تاریخ نامعتبر قبلاً به new Date("...") می‌رفت و Invalid Date تولید می‌کرد.
    const from = safeDate(url.searchParams.get("from") ? `${url.searchParams.get("from")}T00:00:00` : null);
    const to = safeDate(url.searchParams.get("to") ? `${url.searchParams.get("to")}T23:59:59` : null);
    const svc = serviceClient();

    let salesQuery = svc
      .from("sales")
      .select("id, invoice_no, date, total, paid_credit, status, created_by, customer:contacts(name)")
      .eq("org_id", membership.org_id)
      .neq("status", "cancelled")
      .order("date", { ascending: false })
      .limit(5000);
    if (from) salesQuery = salesQuery.gte("date", from);
    if (to) salesQuery = salesQuery.lte("date", to);

    let activityQuery = svc
      .from("activity_logs")
      .select("id, user_id, action, entity_type, created_at")
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (from) activityQuery = activityQuery.gte("created_at", from);
    if (to) activityQuery = activityQuery.lte("created_at", to);

    const [{ data: sales, error: salesError }, { data: activities, error: activityError }] = await Promise.all([salesQuery, activityQuery]);
    if (salesError) throw salesError;
    if (activityError) throw activityError;

    const userIds = Array.from(new Set([...(sales ?? []).map((s: any) => s.created_by), ...(activities ?? []).map((a: any) => a.user_id)].filter(Boolean)));
    const userMap: Record<string, { email: string; name: string }> = {};
    await Promise.all(userIds.map(async (id) => {
      const { data } = await svc.auth.admin.getUserById(id);
      userMap[id] = {
        email: data.user?.email ?? "",
        name: data.user?.user_metadata?.name ?? data.user?.email ?? "کاربر",
      };
    }));

    const stats = new Map<string, any>();
    function ensure(userId: string | null) {
      const key = userId || "unknown";
      if (!stats.has(key)) {
        stats.set(key, {
          user_id: userId,
          user: userId ? userMap[userId] ?? null : null,
          invoice_count: 0,
          sales_total: 0,
          credit_total: 0,
          average_invoice: 0,
          activity_count: 0,
          last_sale_at: null,
        });
      }
      return stats.get(key);
    }

    (sales ?? []).forEach((sale: any) => {
      const row = ensure(sale.created_by ?? null);
      row.invoice_count += 1;
      row.sales_total += sale.total ?? 0;
      row.credit_total += sale.paid_credit ?? 0;
      if (!row.last_sale_at || new Date(sale.date) > new Date(row.last_sale_at)) row.last_sale_at = sale.date;
    });

    (activities ?? []).forEach((activity: any) => {
      const row = ensure(activity.user_id ?? null);
      row.activity_count += 1;
    });

    const sellers = Array.from(stats.values()).map((row) => ({
      ...row,
      average_invoice: row.invoice_count ? Math.round(row.sales_total / row.invoice_count) : 0,
    })).sort((a, b) => b.sales_total - a.sales_total);

    return NextResponse.json({ sellers, sales: sales ?? [] });
  } catch (error) {
    return safeError("reports/sellers:GET", error);
  }
}
