import { NextResponse } from "next/server";
import {
  requirePlatformPermission,
  safeError,
  boundedInt,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/** فهرست رویدادهای ممیزی سطح پلتفرم — فقط خواندنی. */
export async function GET(request: Request) {
  try {
    const rl = hit(`admin-audit:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformPermission("audit.view");
    if ("response" in auth) return auth.response;

    const url = new URL(request.url);
    const limit = boundedInt(url.searchParams.get("limit"), 1, 200, 100);
    const action = url.searchParams.get("action");
    const actor = url.searchParams.get("actor");

    let query = auth.svc
      .from("v_platform_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    // فیلترها اختیاری‌اند؛ مقدار خالی نباید به کوئری برود.
    if (action) query = query.eq("action", action);
    if (actor) query = query.eq("actor_id", actor);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ events: data ?? [], viewerRole: auth.role });
  } catch (e) {
    return safeError("admin/audit:GET", e);
  }
}
