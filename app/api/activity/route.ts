import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { roleHasPermission } from "@/lib/permissions";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function service() {
  if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY تنظیم نشده است");
  return createServiceClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership, error: memError } = await supabase
      .from("memberships")
      .select("org_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();
    if (memError || !membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!roleHasPermission(membership.role as any, "reports.view") && !roleHasPermission(membership.role as any, "settings.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const entityType = url.searchParams.get("entity_type");
    const action = url.searchParams.get("action");
    const limit = Math.min(Number(url.searchParams.get("limit") || 100), 200);
    const svc = service();

    let q = svc
      .from("activity_logs")
      .select("id, org_id, user_id, action, entity_type, entity_id, old_data, new_data, user_agent, created_at")
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (entityType) q = q.eq("entity_type", entityType);
    if (action) q = q.eq("action", action);

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
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
