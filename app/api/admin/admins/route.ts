import { NextResponse } from "next/server";
import {
  requirePlatformPermission,
  safeError,
  readJsonBody,
  requestIp,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIXED_ROLES = ["super_admin", "support", "finance", "readonly"] as const;
const ALL_ROLES = [...FIXED_ROLES, "custom"] as const;

/**
 * مدیریت ادمین‌های پلتفرم و نقش‌های سفارشی.
 *
 * چرا نقش سفارشی لازم شد:
 *   چهار نقش ثابت بودند و برای دادن یک مجوز اضافه به کسی، تنها راه
 *   ارتقای او به super_admin بود — یعنی دادن *همه‌ی* اختیارات، از
 *   جمله بازنشانی رمز و مدیریت بقیه‌ی ادمین‌ها.
 */

/** فهرست ادمین‌ها + کاتالوگ مجوزها. */
export async function GET(request: Request) {
  try {
    const rl = hit(`admins-get:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformPermission("admins.manage");
    if ("response" in auth) return auth.response;
    const { svc } = auth;

    const [{ data: admins }, { data: permissions }] = await Promise.all([
      svc.from("platform_admins").select("user_id, role, custom_permissions, note, created_at"),
      svc
        .from("platform_permissions")
        .select("key, label, description, category, risk, sort_order")
        .order("sort_order"),
    ]);

    /*
      ایمیل از auth.users می‌آید که جدول جداست. بدون آن، UI فقط UUID
      نشان می‌داد و عملاً غیرقابل استفاده بود.
    */
    const enriched = await Promise.all(
      (admins ?? []).map(async (a: Record<string, unknown>) => {
        const { data } = await svc.auth.admin.getUserById(a.user_id as string);
        return {
          userId: a.user_id as string,
          email: data.user?.email ?? null,
          role: a.role as string,
          customPermissions: (a.custom_permissions as string[]) ?? [],
          note: (a.note as string | null) ?? null,
          createdAt: a.created_at as string,
        };
      })
    );

    return NextResponse.json({ admins: enriched, permissions: permissions ?? [] });
  } catch (error) {
    return safeError("admin/admins:GET", error);
  }
}

/** افزودن ادمین تازه یا تغییر نقش یک ادمین موجود. */
export async function POST(request: Request) {
  try {
    const rl = hit(`admins-post:${clientIp(request)}`, { limit: 20, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformPermission("admins.manage");
    if ("response" in auth) return auth.response;
    const { userId: actorId, svc } = auth;

    const parsed = await readJsonBody<Record<string, unknown>>(request);
    if ("response" in parsed) return parsed.response;

    const targetId = String(parsed.data.user_id ?? "");
    const role = String(parsed.data.role ?? "");
    const custom = Array.isArray(parsed.data.custom_permissions)
      ? (parsed.data.custom_permissions as unknown[]).map(String)
      : [];
    const note = String(parsed.data.note ?? "").trim() || null;

    if (!UUID_RE.test(targetId)) {
      return NextResponse.json({ error: "شناسه کاربر نامعتبر است." }, { status: 400 });
    }
    if (!ALL_ROLES.includes(role as (typeof ALL_ROLES)[number])) {
      return NextResponse.json({ error: "نقش نامعتبر است." }, { status: 400 });
    }
    if (role === "custom" && custom.length === 0) {
      /*
        نقش سفارشی بدون مجوز یعنی ادمینی که هیچ کاری نمی‌تواند بکند —
        تقریباً همیشه نشانه‌ی اشتباه کاربر است، نه قصد واقعی.
      */
      return NextResponse.json(
        { error: "برای نقش سفارشی حداقل یک مجوز انتخاب کنید." },
        { status: 400 }
      );
    }

    /*
      🔴 ادمین نمی‌تواند نقش خودش را عوض کند.

      دو خطر: تنزل تصادفی که خودش را قفل می‌کند، و ارتقای بی‌نظارت.
      تغییر نقش یک ادمین باید همیشه کار *شخص دیگری* باشد.
    */
    if (targetId === actorId) {
      return NextResponse.json(
        { error: "نمی‌توانید نقش خودتان را تغییر دهید." },
        { status: 400 }
      );
    }

    const { data: existing } = await svc
      .from("platform_admins")
      .select("role")
      .eq("user_id", targetId)
      .maybeSingle();

    // کاربر باید وجود داشته باشد.
    const { data: targetUser, error: userError } = await svc.auth.admin.getUserById(targetId);
    if (userError || !targetUser.user) {
      return NextResponse.json({ error: "کاربر یافت نشد." }, { status: 404 });
    }

    await svc.rpc("log_platform_action", {
      p_action: existing ? "admin.role_change" : "admin.grant",
      p_actor: actorId,
      p_target_type: "user",
      p_target_id: targetId,
      p_target_name: targetUser.user.email ?? null,
      p_reason: note,
      p_meta: { role, custom_permissions: custom, previous_role: existing?.role ?? null },
      p_ip: requestIp(request),
    });

    const { error } = await svc.from("platform_admins").upsert(
      {
        user_id: targetId,
        role,
        custom_permissions: role === "custom" ? custom : [],
        note,
        created_by: actorId,
      },
      { onConflict: "user_id" }
    );
    /*
      خطای تریگر اعتبارسنجی (مجوز ناشناخته) با پیام فارسی برمی‌گردد و
      باید به کاربر نشان داده شود، نه اینکه به خطای عمومی ۵۰۰ تبدیل شود.
    */
    if (error) {
      if (error.message?.includes("مجوز نامعتبر")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return safeError("admin/admins:POST", error);
  }
}

/** حذف دسترسی ادمین. */
export async function DELETE(request: Request) {
  try {
    const rl = hit(`admins-del:${clientIp(request)}`, { limit: 20, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformPermission("admins.manage");
    if ("response" in auth) return auth.response;
    const { userId: actorId, svc } = auth;

    const parsed = await readJsonBody<Record<string, unknown>>(request);
    if ("response" in parsed) return parsed.response;
    const targetId = String(parsed.data.user_id ?? "");

    if (!UUID_RE.test(targetId)) {
      return NextResponse.json({ error: "شناسه کاربر نامعتبر است." }, { status: 400 });
    }
    if (targetId === actorId) {
      return NextResponse.json(
        { error: "نمی‌توانید دسترسی خودتان را حذف کنید." },
        { status: 400 }
      );
    }

    /*
      🔴 آخرین super_admin نباید حذف شود.

      بدون این بررسی، حذف تنها super_admin باقی‌مانده یعنی هیچ‌کس دیگر
      نمی‌تواند ادمین اضافه کند — پلتفرم برای همیشه بدون مدیر می‌ماند و
      تنها راه بازگشت، دست‌کاری مستقیم دیتابیس است.
    */
    const { data: target } = await svc
      .from("platform_admins")
      .select("role")
      .eq("user_id", targetId)
      .maybeSingle();

    if (!target) return NextResponse.json({ error: "ادمین یافت نشد." }, { status: 404 });

    if (target.role === "super_admin") {
      const { count } = await svc
        .from("platform_admins")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "super_admin");
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "آخرین مدیر ارشد را نمی‌توان حذف کرد." },
          { status: 400 }
        );
      }
    }

    const { data: targetUser } = await svc.auth.admin.getUserById(targetId);

    await svc.rpc("log_platform_action", {
      p_action: "admin.revoke",
      p_actor: actorId,
      p_target_type: "user",
      p_target_id: targetId,
      p_target_name: targetUser?.user?.email ?? null,
      p_reason: null,
      p_meta: { previous_role: target.role },
      p_ip: requestIp(request),
    });

    const { error } = await svc.from("platform_admins").delete().eq("user_id", targetId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return safeError("admin/admins:DELETE", error);
  }
}
