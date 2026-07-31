import { NextResponse } from "next/server";
import {
  requirePlatformAdmin,
  safeError,
  isUuid,
  readJsonBody,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";


/*
  این روت به هدرهای درخواست (برای rate limiting و کوکی نشست) نیاز دارد،
  پس نباید در زمان بیلد استاتیک رندر شود. بدون این خط، Next هشدار
  «Dynamic server usage» می‌داد.
*/
export const dynamic = "force-dynamic";


/**
 * API پنل سوپرادمین — فهرست سازمان‌ها و تأیید/رد آن‌ها.
 *
 * گارد دسترسی دو لایه دارد:
 *  ۱. اینجا: عضویت کاربر در platform_admins چک می‌شود.
 *  ۲. دیتابیس: RPCهای approve/reject خودشان is_platform_admin() را
 *     دوباره چک می‌کنند، پس حتی اگر این لایه دور زده شود، عملیات رد می‌شود.
 */

export async function GET(request: Request) {
  try {
    const rl = hit(`admin-orgs-get:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformAdmin();
    if ("response" in auth) return auth.response;

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
    return safeError("admin/organizations:GET", e);
  }
}

export async function POST(request: Request) {
  try {
    // عملیات تأیید/رد حساس است: سقف سخت‌گیرانه‌تر.
    const rl = hit(`admin-orgs-post:${clientIp(request)}`, {
      limit: 20,
      windowSeconds: 60,
      blockSeconds: 300,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformAdmin();
    if ("response" in auth) return auth.response;

    const parsed = await readJsonBody<{ org_id?: string; action?: string; reason?: string }>(request);
    if ("response" in parsed) return parsed.response;
    const { org_id, action } = parsed.data;
    // متن دلیل محدود می‌شود تا ستون متنی با payload چندمگابایتی پر نشود.
    const reason = typeof parsed.data.reason === "string" ? parsed.data.reason.slice(0, 500) : null;

    if (!isUuid(org_id) || (action !== "approve" && action !== "reject")) {
      return NextResponse.json({ error: "پارامترهای نامعتبر" }, { status: 400 });
    }

    /*
      p_actor صریح پاس داده می‌شود چون این کلاینت با service_role کار می‌کند
      و در آن حالت auth.uid() داخل دیتابیس NULL است (migration 0022).
      هویت auth.user از قبل در requirePlatformAdmin تأیید شده است.
    */
    const rpc =
      action === "approve"
        ? auth.svc.rpc("approve_organization", { p_org: org_id, p_actor: auth.userId })
        : auth.svc.rpc("reject_organization", {
            p_org: org_id,
            p_reason: reason,
            p_actor: auth.userId,
          });

    const { error } = await rpc;
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return safeError("admin/organizations:POST", e);
  }
}
