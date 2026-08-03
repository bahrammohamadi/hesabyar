import { NextResponse } from "next/server";
import {
  requirePlatformPermission,
  safeError,
  isUuid,
  readJsonBody,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const TONES = new Set(["info", "success", "warning", "danger"]);

/** فهرست اعلان‌ها برای پنل ادمین (شامل غیرفعال‌ها). */
export async function GET() {
  try {
    const auth = await requirePlatformPermission("announcements.manage");
    if ("response" in auth) return auth.response;

    const { data, error } = await auth.svc
      .from("platform_announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    return NextResponse.json({ announcements: data ?? [] });
  } catch (e) {
    return safeError("admin/announcements:GET", e);
  }
}

export async function POST(request: Request) {
  try {
    const rl = hit(`ann-post:${clientIp(request)}`, { limit: 20, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformPermission("announcements.manage");
    if ("response" in auth) return auth.response;

    const parsed = await readJsonBody<{
      title?: string; body?: string; tone?: string;
      org_id?: string | null; ends_at?: string | null;
    }>(request);
    if ("response" in parsed) return parsed.response;

    const title = (parsed.data.title ?? "").trim().slice(0, 200);
    const body = (parsed.data.body ?? "").trim().slice(0, 2000);
    const tone = TONES.has(parsed.data.tone ?? "") ? parsed.data.tone! : "info";
    const orgId = parsed.data.org_id;

    if (title.length < 3) {
      return NextResponse.json({ error: "عنوان اعلان را بنویسید" }, { status: 400 });
    }
    // org_id اختیاری است، ولی اگر آمد باید uuid معتبر باشد (جلوگیری از IDOR)
    if (orgId != null && orgId !== "" && !isUuid(orgId)) {
      return NextResponse.json({ error: "شناسه‌ی کسب‌وکار نامعتبر است" }, { status: 400 });
    }

    const { data, error } = await auth.svc
      .from("platform_announcements")
      .insert({
        title, body: body || null, tone,
        org_id: orgId || null,
        ends_at: parsed.data.ends_at || null,
        created_by: auth.userId,
      })
      .select("id")
      .single();
    if (error) throw error;

    await auth.svc.rpc("log_platform_action", {
      p_action: "announcement.created",
      p_actor: auth.userId,
      p_target_type: "announcement",
      p_target_id: data.id,
      p_target_name: title,
      p_reason: null,
      p_meta: { tone, scoped: Boolean(orgId) },
      p_ip: clientIp(request),
    });

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    return safeError("admin/announcements:POST", e);
  }
}

/** فعال/غیرفعال کردن. حذف نمی‌کنیم تا ردپا بماند. */
export async function PATCH(request: Request) {
  try {
    const auth = await requirePlatformPermission("announcements.manage");
    if ("response" in auth) return auth.response;

    const parsed = await readJsonBody<{ id?: string; is_active?: boolean }>(request);
    if ("response" in parsed) return parsed.response;
    const { id, is_active } = parsed.data;

    if (!isUuid(id) || typeof is_active !== "boolean") {
      return NextResponse.json({ error: "پارامترهای نامعتبر" }, { status: 400 });
    }

    const { error } = await auth.svc
      .from("platform_announcements")
      .update({ is_active })
      .eq("id", id);
    if (error) throw error;

    await auth.svc.rpc("log_platform_action", {
      p_action: is_active ? "announcement.enabled" : "announcement.disabled",
      p_actor: auth.userId,
      p_target_type: "announcement",
      p_target_id: id,
      p_target_name: null,
      p_reason: null,
      p_meta: {},
      p_ip: clientIp(request),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return safeError("admin/announcements:PATCH", e);
  }
}
