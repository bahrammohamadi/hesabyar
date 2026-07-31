import { NextResponse } from "next/server";
import {
  requireMember,
  serviceClient,
  safeError,
  isUuid,
  readJsonBody,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { roleHasPermission } from "@/lib/permissions";


/*
  این روت به هدرهای درخواست (برای rate limiting و کوکی نشست) نیاز دارد،
  پس نباید در زمان بیلد استاتیک رندر شود. بدون این خط، Next هشدار
  «Dynamic server usage» می‌داد.
*/
export const dynamic = "force-dynamic";


const ALLOWED_ROLES = ["owner", "manager", "cashier", "inventory", "accountant"] as const;

type Role = typeof ALLOWED_ROLES[number];

/**
 * فقط owner یا نقش دارای settings.manage اجازه‌ی مدیریت کاربران دارد.
 * جدا از requireMember نگه داشته شده چون علاوه بر مجوز، به org_id و
 * branch_id هم نیاز داریم.
 */
async function requireUserAdmin(orgId?: string | null) {
  const auth = await requireMember(orgId);
  if ("response" in auth) return auth;

  const { membership } = auth.ctx;
  if (!roleHasPermission(membership.role as never, "settings.manage") && membership.role !== "owner") {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return auth;
}

/**
 * فهرست سفید مجوزهایی که می‌توان به کاربر داد.
 *
 * 🔴 آسیب‌پذیری رفع‌شده: قبلاً `body.permissions` هر رشته‌ای را می‌پذیرفت و
 * مستقیم در app_metadata ذخیره می‌شد. یک manager می‌توانست رشته‌ی "*" را
 * بفرستد و مجوز کامل بگیرد (ارتقای عمودی سطح دسترسی).
 */
const ASSIGNABLE_PERMISSIONS = new Set([
  "contacts.view", "contacts.edit", "contacts.call", "crm.create",
  "sales.view", "sales.create", "purchases.view", "purchases.create",
  "products.view", "products.edit", "products.update_price",
  "inventory.view", "inventory.adjust",
  "finance.view", "finance.create", "reports.view",
]);

function sanitizePermissions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(raw.map(String).filter((p) => ASSIGNABLE_PERMISSIONS.has(p)))
  ).slice(0, 32);
}

export async function GET(request: Request) {
  try {
    const rl = hit(`admin-users-get:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const url = new URL(request.url);
    const auth = await requireUserAdmin(url.searchParams.get("org_id"));
    if ("response" in auth) return auth.response;
    const svc = serviceClient();

    const { data: memberships, error } = await svc
      .from("memberships")
      .select("id, user_id, org_id, branch_id, role, is_active, created_at")
      .eq("org_id", auth.ctx.membership.org_id)
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
    return safeError("admin/users", error);
  }
}

export async function POST(request: Request) {
  try {
    // ساخت کاربر پرهزینه و حساس است: سقف سخت.
    const rl = hit(`admin-users-create:${clientIp(request)}`, {
      limit: 10,
      windowSeconds: 300,
      blockSeconds: 600,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const parsed = await readJsonBody<Record<string, unknown>>(request);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const auth = await requireUserAdmin(typeof body.org_id === "string" ? body.org_id : null);
    if ("response" in auth) return auth.response;

    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 254);
    const password = String(body.password ?? "");
    const name = String(body.name ?? "").trim().slice(0, 120);
    const role = String(body.role ?? "cashier") as Role;
    const permissions = sanitizePermissions(body.permissions);

    // اعتبارسنجی سخت‌گیرانه‌تر: قبلاً هر رشته‌ای به‌عنوان ایمیل پذیرفته می‌شد.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "ایمیل نامعتبر است" }, { status: 400 });
    }
    // سیاست رمز: حداقل ۸ کاراکتر (قبلاً ۶ بود) و نه از فهرست رمزهای رایج.
    if (password.length < 8 || password.length > 72) {
      return NextResponse.json({ error: "رمز عبور باید بین ۸ تا ۷۲ کاراکتر باشد" }, { status: 400 });
    }
    const WEAK = new Set(["12345678", "123456789", "password", "qwertyui", "11111111", "abcd1234"]);
    if (WEAK.has(password.toLowerCase())) {
      return NextResponse.json({ error: "رمز عبور بسیار ساده است" }, { status: 400 });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "نقش نامعتبر است" }, { status: 400 });
    }
    // فقط owner می‌تواند owner بسازد (جلوگیری از ارتقای سطح توسط manager).
    if (role === "owner" && auth.ctx.membership.role !== "owner") {
      return NextResponse.json({ error: "فقط مالک می‌تواند مالک جدید تعریف کند" }, { status: 403 });
    }

    const svc = serviceClient();
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
      org_id: auth.ctx.membership.org_id,
      branch_id: auth.ctx.membership.branch_id,
      user_id: userId,
      role,
      is_active: true,
      created_by: auth.ctx.userId,
    });
    // اگر ثبت عضویت شکست خورد، کاربر ساخته‌شده را پاک می‌کنیم تا
    // حساب یتیم و بدون سازمان باقی نماند.
    if (memError) {
      await svc.auth.admin.deleteUser(userId).catch(() => {});
      throw memError;
    }

    return NextResponse.json({ ok: true, user_id: userId });
  } catch (error) {
    return safeError("admin/users", error);
  }
}

export async function PATCH(request: Request) {
  try {
    const rl = hit(`admin-users-patch:${clientIp(request)}`, { limit: 30, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const parsed = await readJsonBody<Record<string, unknown>>(request);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const auth = await requireUserAdmin(typeof body.org_id === "string" ? body.org_id : null);
    if ("response" in auth) return auth.response;

    const membershipId = String(body.membership_id ?? "");
    const userId = String(body.user_id ?? "");
    const role = body.role ? (String(body.role) as Role) : null;
    const isActive = typeof body.is_active === "boolean" ? body.is_active : null;
    const permissions = body.permissions !== undefined ? sanitizePermissions(body.permissions) : null;

    // شناسه‌های نامعتبر قبلاً بدون بررسی وارد کوئری می‌شدند.
    if (!isUuid(membershipId)) {
      return NextResponse.json({ error: "شناسه عضویت نامعتبر است" }, { status: 400 });
    }
    if (userId && !isUuid(userId)) {
      return NextResponse.json({ error: "شناسه کاربر نامعتبر است" }, { status: 400 });
    }
    if (role === "owner" && auth.ctx.membership.role !== "owner") {
      return NextResponse.json({ error: "فقط مالک می‌تواند نقش مالک بدهد" }, { status: 403 });
    }

    const svc = serviceClient();

    /*
      🔴 IDOR رفع‌شده: قبلاً `permissions` با user_id دلخواه به‌روزرسانی می‌شد
      بدون اینکه بررسی شود آن کاربر عضو همین سازمان است. مهاجم می‌توانست
      مجوزهای کاربر یک سازمان دیگر را تغییر دهد.
    */
    const { data: target, error: targetError } = await svc
      .from("memberships")
      .select("id, user_id, role, org_id")
      .eq("id", membershipId)
      .eq("org_id", auth.ctx.membership.org_id)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ error: "عضویت یافت نشد" }, { status: 404 });
    if (userId && target.user_id !== userId) {
      return NextResponse.json({ error: "عدم تطابق کاربر و عضویت" }, { status: 400 });
    }
    // جلوگیری از قفل‌شدن سازمان: مالک نمی‌تواند خودش را غیرفعال کند.
    if (isActive === false && target.user_id === auth.ctx.userId) {
      return NextResponse.json({ error: "نمی‌توانید حساب خودتان را غیرفعال کنید" }, { status: 400 });
    }
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
        .eq("org_id", auth.ctx.membership.org_id);
      if (error) throw error;
    }

    if (permissions) {
      const { error } = await svc.auth.admin.updateUserById(target.user_id, {
        app_metadata: { permissions },
      });
      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return safeError("admin/users", error);
  }
}
