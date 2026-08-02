import { NextResponse } from "next/server";
import {
  requirePlatformPermission,
  safeError,
  isUuid,
  readJsonBody,
  requestIp,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * جزئیات یک سازمان + عملیات مدیریتی روی آن.
 *
 * هر عمل دو گارد دارد:
 *   ۱. اینجا: requirePlatformPermission با مجوز دقیق
 *   ۲. دیتابیس: خود RPC دوباره platform_admin_can را چک می‌کند
 * حذف هرکدام به‌تنهایی نباید در را باز کند.
 */

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const rl = hit(`admin-org-get:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    if (!isUuid(params.id)) {
      return NextResponse.json({ error: "شناسه نامعتبر" }, { status: 400 });
    }

    const auth = await requirePlatformPermission("orgs.view");
    if ("response" in auth) return auth.response;

    const { data, error } = await auth.svc
      .from("v_admin_org_detail")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "سازمان یافت نشد" }, { status: 404 });

    // ایمیل مالک در نما نیست (روی auth.users است)
    let ownerEmail = "";
    if (data.owner_id) {
      const { data: u } = await auth.svc.auth.admin.getUserById(data.owner_id as string);
      ownerEmail = u.user?.email ?? "";
    }

    // اعضای سازمان
    const { data: members } = await auth.svc
      .from("memberships")
      .select("user_id, role, created_at, is_active")
      .eq("org_id", params.id)
      .eq("is_active", true)
      .order("created_at");

    const memberList = await Promise.all(
      (members ?? []).map(async (m) => {
        const { data: u } = await auth.svc.auth.admin.getUserById(m.user_id as string);
        return {
          user_id: m.user_id,
          role: m.role,
          created_at: m.created_at,
          email: u.user?.email ?? "",
          last_sign_in_at: u.user?.last_sign_in_at ?? null,
        };
      })
    );

    // آخرین رویدادهای ممیزی همین سازمان
    const { data: audit } = await auth.svc
      .from("v_platform_audit")
      .select("*")
      .eq("target_id", params.id)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      organization: { ...data, owner_email: ownerEmail },
      members: memberList,
      audit: audit ?? [],
      viewerRole: auth.role,
    });
  } catch (e) {
    return safeError("admin/organizations/[id]:GET", e);
  }
}

type Body = { action?: string; reason?: string; days?: number };

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const rl = hit(`admin-org-post:${clientIp(request)}`, {
      limit: 20,
      windowSeconds: 60,
      blockSeconds: 300,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    if (!isUuid(params.id)) {
      return NextResponse.json({ error: "شناسه نامعتبر" }, { status: 400 });
    }

    const parsed = await readJsonBody<Body>(request);
    if ("response" in parsed) return parsed.response;
    const { action } = parsed.data;
    const reason =
      typeof parsed.data.reason === "string" ? parsed.data.reason.slice(0, 500) : null;

    /*
      هر عمل به مجوز خودش نیاز دارد. نگاشت اینجا صریح است تا اضافه
      شدن عمل جدید بدون تعیین مجوز ممکن نباشد.
    */
    const NEEDS: Record<string, string> = {
      approve: "orgs.approve",
      reject: "orgs.approve",
      suspend: "orgs.suspend",
      reactivate: "orgs.suspend",
      extend_trial: "trial.extend",
    };
    const permission = action ? NEEDS[action] : undefined;
    if (!permission) {
      return NextResponse.json({ error: "عملیات نامعتبر" }, { status: 400 });
    }

    const auth = await requirePlatformPermission(permission);
    if ("response" in auth) return auth.response;

    const ip = requestIp(request);

    if (action === "extend_trial") {
      const days = Number(parsed.data.days);
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        return NextResponse.json({ error: "تعداد روز باید بین ۱ تا ۳۶۵ باشد" }, { status: 400 });
      }
      const { data, error } = await auth.svc.rpc("extend_trial", {
        p_org: params.id,
        p_days: days,
        p_actor: auth.userId,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, trial_ends_at: data });
    }

    if (action === "approve") {
      const { error } = await auth.svc.rpc("approve_organization", {
        p_org: params.id,
        p_actor: auth.userId,
      });
      if (error) throw error;
    } else if (action === "reject") {
      const { error } = await auth.svc.rpc("reject_organization", {
        p_org: params.id,
        p_reason: reason,
        p_actor: auth.userId,
      });
      if (error) throw error;
    } else {
      // تعلیق / رفع تعلیق
      const { error } = await auth.svc.rpc("set_organization_status", {
        p_org: params.id,
        p_status: action === "suspend" ? "suspended" : "approved",
        p_reason: reason,
        p_actor: auth.userId,
      });
      if (error) throw error;
    }

    /*
      IP در دیتابیس در دسترس نیست، پس RPC نمی‌تواند ثبتش کند.

      ⚠️ رکورد *دوم* نمی‌سازیم: در تست واقعی دیدیم گزارش دو ردیف
      برای هر عمل نشان می‌داد — یکی «تأیید کسب‌وکار» و یکی
      «approve.request» بدون هدف و بدون برچسب فارسی. گزارشی که
      رویداد تکراری دارد، اعتمادش را از دست می‌دهد.

      به‌جایش IP روی همان رکوردی که RPC تازه ساخته به‌روزرسانی
      می‌شود (آخرین رکورد این ادمین روی این سازمان).
    */
    if (ip) {
      const { data: last } = await auth.svc
        .from("platform_audit_logs")
        .select("id")
        .eq("actor_id", auth.userId)
        .eq("target_id", params.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last?.id) {
        await auth.svc.from("platform_audit_logs").update({ ip }).eq("id", last.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return safeError("admin/organizations/[id]:POST", e);
  }
}
