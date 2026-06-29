import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { roleHasPermission } from "@/lib/permissions";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ROLES = ["owner", "manager", "cashier", "inventory", "accountant"] as const;

type Role = typeof ALLOWED_ROLES[number];

function service() {
  if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY تنظیم نشده است");
  return createServiceClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: membership, error: memError } = await supabase
    .from("memberships")
    .select("org_id, branch_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (memError || !membership) return { error: NextResponse.json({ error: "Membership not found" }, { status: 403 }) };
  if (!roleHasPermission(membership.role as any, "settings.manage") && membership.role !== "owner") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user, membership };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const svc = service();

    const { data: memberships, error } = await svc
      .from("memberships")
      .select("id, user_id, org_id, branch_id, role, is_active, created_at")
      .eq("org_id", auth.membership.org_id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const users = await Promise.all((memberships ?? []).map(async (m: any) => {
      const { data } = await svc.auth.admin.getUserById(m.user_id);
      return {
        ...m,
        email: data.user?.email ?? "",
        name: data.user?.user_metadata?.name ?? data.user?.email ?? "",
        permissions: data.user?.app_metadata?.permissions ?? null,
      };
    }));

    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const name = String(body.name ?? "").trim();
    const role = String(body.role ?? "cashier") as Role;
    const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : [];

    if (!email || !password || password.length < 6) {
      return NextResponse.json({ error: "ایمیل و رمز حداقل ۶ کاراکتر الزامی است" }, { status: 400 });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "نقش نامعتبر است" }, { status: 400 });
    }

    const svc = service();
    const { data: created, error: createError } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
      app_metadata: { permissions },
    });
    if (createError) throw createError;
    const userId = created.user.id;

    const { error: memError } = await svc.from("memberships").insert({
      org_id: auth.membership.org_id,
      branch_id: auth.membership.branch_id,
      user_id: userId,
      role,
      is_active: true,
      created_by: auth.user.id,
    });
    if (memError) throw memError;

    return NextResponse.json({ ok: true, user_id: userId });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const body = await request.json();
    const membershipId = String(body.membership_id ?? "");
    const userId = String(body.user_id ?? "");
    const role = body.role ? String(body.role) as Role : null;
    const isActive = typeof body.is_active === "boolean" ? body.is_active : null;
    const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : null;

    const svc = service();
    const update: Record<string, unknown> = {};
    if (role) {
      if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "نقش نامعتبر است" }, { status: 400 });
      update.role = role;
    }
    if (isActive !== null) update.is_active = isActive;

    if (Object.keys(update).length > 0) {
      const { error } = await svc
        .from("memberships")
        .update(update)
        .eq("id", membershipId)
        .eq("org_id", auth.membership.org_id);
      if (error) throw error;
    }

    if (permissions && userId) {
      const { error } = await svc.auth.admin.updateUserById(userId, {
        app_metadata: { permissions },
      });
      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
