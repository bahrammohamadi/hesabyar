import { NextResponse } from "next/server";
import {
  requireMember,
  serviceClient,
  safeError,
  boundedInt,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { roleHasPermission } from "@/lib/permissions";


/*
  این روت به هدرهای درخواست (برای rate limiting و کوکی نشست) نیاز دارد،
  پس نباید در زمان بیلد استاتیک رندر شود. بدون این خط، Next هشدار
  «Dynamic server usage» می‌داد.
*/
export const dynamic = "force-dynamic";


export async function GET(request: Request) {
  try {
    const rl = hit(`activity:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const url = new URL(request.url);
    const auth = await requireMember(url.searchParams.get("org_id"));
    if ("response" in auth) return auth.response;
    const { membership } = auth.ctx;

    if (
      !roleHasPermission(membership.role as never, "reports.view") &&
      !roleHasPermission(membership.role as never, "settings.manage")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // فهرست سفید: ورودی آزاد مستقیم وارد فیلتر دیتابیس نمی‌شود.
    const ALLOWED_ENTITIES = new Set([
      "sale", "purchase", "contact", "product", "variant",
      "transaction", "stock_movement", "user", "organization",
    ]);
    const ALLOWED_ACTIONS = new Set(["create", "update", "delete", "cancel", "login", "restore"]);

    const rawEntity = url.searchParams.get("entity_type");
    const rawAction = url.searchParams.get("action");
    const entityType = rawEntity && ALLOWED_ENTITIES.has(rawEntity) ? rawEntity : null;
    const action = rawAction && ALLOWED_ACTIONS.has(rawAction) ? rawAction : null;

    /*
      بازه‌ی تاریخ.

      اعتبارسنجی سخت‌گیرانه با regex انجام می‌شود و نه Date.parse:
      این مقدار مستقیم وارد فیلتر PostgREST می‌شود، پس فقط شکل دقیق
      `YYYY-MM-DD` پذیرفته است. هر چیز دیگری بی‌صدا نادیده گرفته
      می‌شود (همان رفتار فهرست سفید بالا).
    */
    const isoDay = (raw: string | null) =>
      raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
    const from = isoDay(url.searchParams.get("from"));
    const to = isoDay(url.searchParams.get("to"));
    // Number(null) قبلاً می‌توانست NaN بدهد؛ حالا کران‌دار است.
    const limit = boundedInt(url.searchParams.get("limit"), 1, 200, 100);
    const svc = serviceClient();

    let q = svc
      .from("activity_logs")
      .select("id, org_id, user_id, action, entity_type, entity_id, old_data, new_data, user_agent, created_at")
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (entityType) q = q.eq("entity_type", entityType);
    if (action) q = q.eq("action", action);
    if (from) q = q.gte("created_at", from);
    /*
      created_at از نوع timestamptz است. `lte(to)` یعنی «تا ساعت ۰۰:۰۰
      آن روز» و همه‌ی فعالیت‌های همان روز را حذف می‌کرد. کران بالا
      «کوچک‌تر از روز بعد» گرفته می‌شود.
    */
    if (to) {
      const [y, m, d] = to.split("-").map(Number);
      const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
      q = q.lt("created_at", next);
    }

    const { data: logs, error: logsError } = await q;
    if (logsError) throw logsError;

    const userIds = Array.from(new Set((logs ?? []).map((l: any) => l.user_id).filter(Boolean)));
    const userMap: Record<string, { email: string; name: string }> = {};
    await Promise.all(userIds.map(async (id) => {
      const { data } = await svc.auth.admin.getUserById(id);
      userMap[id] = {
        email: data.user?.email ?? "",
        name: data.user?.user_metadata?.name ?? data.user?.email ?? "",
      };
    }));

    return NextResponse.json({
      logs: (logs ?? []).map((log: any) => ({
        ...log,
        user: log.user_id ? userMap[log.user_id] ?? null : null,
      })),
    });
  } catch (error) {
    return safeError("activity:GET", error);
  }
}
