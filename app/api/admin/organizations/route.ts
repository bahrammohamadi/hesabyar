import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * API پنل سوپرادمین — فهرست سازمان‌ها و تأیید/رد آن‌ها.
 *
 * گارد دسترسی دو لایه دارد:
 *  ۱. اینجا: عضویت کاربر در platform_admins چک می‌شود.
 *  ۲. دیتابیس: RPCهای approve/reject خودشان is_platform_admin() را
 *     دوباره چک می‌کنند، پس حتی اگر این لایه دور زده شود، عملیات رد می‌شود.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function service() {
  if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY تنظیم نشده است");
  return createServiceClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** آیا کاربر جاری سوپرادمین است؟ */
async function requirePlatformAdmin() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const svc = service();
  const { data: admin } = await svc
    .from("platform_admins")
    .select("user_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, admin, svc };
}

export async function GET() {
  try {
    const auth = await requirePlatformAdmin();
    if (auth.error) return auth.error;

    const { data, error } = await auth.svc
      .from("v_admin_organizations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;

    // ایمیل مالک از auth.users خوانده می‌شود (در view نیست)
    const ownerIds = Array.from(new Set((data ?? []).map((o: any) => o.owner_id).filter(Boolean)));
    const emails: Record<string, string> = {};
    await Promise.all(
      ownerIds.map(async (id) => {
        const { data: u } = await auth.svc.auth.admin.getUserById(id as string);
        emails[id as string] = u.user?.email ?? "";
      })
    );

    return NextResponse.json({
      organizations: (data ?? []).map((o: any) => ({ ...o, owner_email: emails[o.owner_id] ?? "" })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePlatformAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const { org_id, action, reason } = body as {
      org_id?: string;
      action?: "approve" | "reject";
      reason?: string;
    };

    if (!org_id || (action !== "approve" && action !== "reject")) {
      return NextResponse.json({ error: "پارامترهای نامعتبر" }, { status: 400 });
    }

    // از همان RPCهای migration 0021 استفاده می‌شود تا منطق در یک جا بماند.
    const rpc =
      action === "approve"
        ? auth.svc.rpc("approve_organization", { p_org: org_id })
        : auth.svc.rpc("reject_organization", { p_org: org_id, p_reason: reason ?? null });

    const { error } = await rpc;
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
