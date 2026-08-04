import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient, safeError, readJsonBody } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { parseUserAgent } from "@/lib/security/user-agent";
import { logActivityServer } from "@/lib/utils/activity-log-server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * نشست‌های فعال کاربر.
 *
 * 🔴 چرا لازم است: پس از تغییر رمز، نشست‌های قدیمی همچنان معتبر
 * می‌مانند. یعنی اگر کسی رمز شما را داشته و شما عوضش کردید، او هنوز
 * وارد است. تا پیش از این هیچ راهی برای بیرون‌انداختنش نبود.
 *
 * همچنین کشف شد ۹۴ نشست فعال برای ۴ کاربر وجود دارد که **هیچ‌کدام
 * تاریخ انقضا ندارند** — چون `sessions_timebox` فقط در پلن Pro
 * قابل تنظیم است.
 */
export async function GET(request: Request) {
  try {
    const rl = hit(`sessions-get:${clientIp(request)}`, { limit: 30, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const svc = serviceClient();
    const { data, error } = await svc
      .from("v_user_sessions")
      .select("id, created_at, refreshed_at, updated_at, user_agent, ip")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false, nullsFirst: false });

    if (error) throw error;

    /*
      نشست فعلی کدام است؟

      Supabase شناسه‌ی نشست را در claim `session_id` توکن می‌گذارد.
      بدون آن، کاربر نمی‌داند کدام ردیف خودش است و ممکن است اشتباهی
      نشست جاری را ببندد.
    */
    const { data: sessionData } = await supabase.auth.getSession();
    const currentSessionId = (sessionData.session?.access_token &&
      parseJwtClaim(sessionData.session.access_token, "session_id")) || null;

    const sessions = (data ?? []).map((s: Record<string, unknown>) => {
      const device = parseUserAgent(s.user_agent as string | null);
      return {
        id: s.id as string,
        createdAt: s.created_at as string,
        lastSeen: (s.refreshed_at ?? s.updated_at ?? s.created_at) as string,
        ip: (s.ip as string | null) ?? null,
        device: device.label,
        kind: device.kind,
        isCurrent: s.id === currentSessionId,
      };
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    return safeError("account/sessions:GET", error);
  }
}

/**
 * بستن یک نشست، یا همه‌ی نشست‌های دیگر.
 *
 * body: { session_id } یا { all_others: true }
 */
export async function DELETE(request: Request) {
  try {
    const rl = hit(`sessions-del:${clientIp(request)}`, { limit: 20, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = await readJsonBody<Record<string, unknown>>(request);
    if ("response" in parsed) return parsed.response;

    const svc = serviceClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const currentSessionId = (sessionData.session?.access_token &&
      parseJwtClaim(sessionData.session.access_token, "session_id")) || null;

    if (parsed.data.all_others === true) {
      /*
        «خروج از همه‌ی دستگاه‌های دیگر».

        نشست جاری عمداً باقی می‌ماند: اگر همه را ببندیم، کاربر بلافاصله
        از همین صفحه هم بیرون می‌افتد و فکر می‌کند چیزی خراب شده.
      */
      const { data: rows } = await svc
        .from("v_user_sessions")
        .select("id")
        .eq("user_id", user.id);

      const others = (rows ?? [])
        .map((r: Record<string, unknown>) => r.id as string)
        .filter((id) => id !== currentSessionId);

      for (const id of others) {
        // API ادمین Supabase راهی برای حذف تک‌نشست ندارد؛ مستقیم حذف می‌کنیم.
        await svc.rpc("delete_user_session", { p_session_id: id, p_user_id: user.id });
      }

      await logActivityServer({
        userId: user.id,
        action: "sessions_revoked",
        entityType: "user",
        entityId: user.id,
        newData: { count: others.length, scope: "others" },
      });

      return NextResponse.json({ ok: true, revoked: others.length });
    }

    const sessionId = String(parsed.data.session_id ?? "");
    if (!UUID_RE.test(sessionId)) {
      return NextResponse.json({ error: "شناسه نشست نامعتبر است." }, { status: 400 });
    }
    if (sessionId === currentSessionId) {
      return NextResponse.json(
        { error: "برای بستن نشست فعلی از دکمه‌ی خروج استفاده کنید." },
        { status: 400 }
      );
    }

    /*
      🔴 p_user_id پاس داده می‌شود و در خود تابع بررسی می‌شود.

      بدون آن، کاربر می‌توانست با حدس‌زدن یک UUID، نشست کاربر دیگری را
      ببندد — یک IDOR کلاسیک.
    */
    const { data: deleted, error } = await svc.rpc("delete_user_session", {
      p_session_id: sessionId,
      p_user_id: user.id,
    });
    if (error) throw error;

    /*
      تابع تعداد ردیف حذف‌شده را برمی‌گرداند. صفر یعنی یا نشست وجود
      نداشت یا مال کاربر دیگری بود.

      🔴 قبلاً در هر دو حالت 200 برمی‌گشت. کاربر فکر می‌کرد نشست بسته
      شده در حالی که نشده — و مهاجم هم بازخوردی می‌گرفت که انگار
      موفق بوده. حالا 404 با پیام یکسان برای هر دو حالت.
    */
    if (Number(deleted ?? 0) === 0) {
      return NextResponse.json({ error: "نشست یافت نشد." }, { status: 404 });
    }

    await logActivityServer({
      userId: user.id,
      action: "sessions_revoked",
      entityType: "user",
      entityId: user.id,
      newData: { count: 1, scope: "single" },
    });

    return NextResponse.json({ ok: true, revoked: 1 });
  } catch (error) {
    return safeError("account/sessions:DELETE", error);
  }
}

/** خواندن یک claim از payload توکن، بدون اعتبارسنجی امضا. */
function parseJwtClaim(token: string, claim: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const value = json?.[claim];
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}
