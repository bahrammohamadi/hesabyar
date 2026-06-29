import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { roleHasPermission } from "@/lib/permissions";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ROLES = ["owner", "manager", "cashier", "inventory", "accountant"] as const;

type Role = typeof ALLOWED_ROLES[number];

const passwordSchema = z
  .string()
  .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد")
  .regex(/[A-Za-z]/, "رمز عبور باید شامل حروف باشد")
  .regex(/[0-9]/, "رمز عبور باید شامل عدد باشد");

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("ایمیل نامعتبر است"),
  password: passwordSchema,
  name: z.string().trim().max(120).optional().default(""),
  role: z.enum(ALLOWED_ROLES).default("cashier"),
  permissions: z.array(z.string()).optional().default([]),
});

const updateUserSchema = z.object({
  membership_id: z.string().optional().default(""),
  user_id: z.string().optional().default(""),
  role: z.enum(ALLOWED_ROLES).optional(),
  is_active: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
});

function service() {
  if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY تنظیم نشده است");
  return createServiceClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Log full error on the server, return a generic, safe message to the client.
function handleError(error: unknown, status = 500) {
  console.error("[admin/users]", error);
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: error.errors[0]?.message ?? "ورودی نامعتبر است" },
      { status: 400 },
    );
  }
  return NextResponse.json({ error: "خطای داخلی سرور رخ داد" }, { status });
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
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const { email, password, name, role, permissions } = createUserSchema.parse(body);

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

    // Roll back the orphaned Auth user if the membership insert fails.
    if (memError) {
      await svc.auth.admin.deleteUser(userId).catch((cleanupError) => {
        console.error("[admin/users] failed to roll back orphan user", userId, cleanupError);
      });
      throw memError;
    }

    return NextResponse.json({ ok: true, user_id: userId });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const { membership_id: membershipId, user_id: userId, role, is_active: isActive, permissions } =
      updateUserSchema.parse(body);

    const svc = service();
    const update: Record<string, unknown> = {};
    if (role) update.role = role;
    if (typeof isActive === "boolean") update.is_active = isActive;

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
    return handleError(error);
  }
}
