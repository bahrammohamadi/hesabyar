import { NextResponse } from "next/server";
import {
  requirePlatformPermission,
  serviceClient,
  safeError,
  isUuid,
  readJsonBody,
  requestIp,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { displayUsername } from "@/lib/utils/format";
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  mapTicketRow,
  validateMessage,
} from "@/lib/support/tickets";

export const dynamic = "force-dynamic";

/**
 * یک تیکت از دید تیم پشتیبانی: خواندن، پاسخ، تغییر وضعیت و واگذاری.
 */

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const rl = hit(`admin-ticket:${clientIp(request)}`, { limit: 120, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    if (!isUuid(params.id)) {
      return NextResponse.json({ error: "شناسه نامعتبر" }, { status: 400 });
    }

    const auth = await requirePlatformPermission("tickets.view");
    if ("response" in auth) return auth.response;

    const { data: ticket, error } = await auth.svc
      .from("v_support_tickets")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw error;
    if (!ticket) return NextResponse.json({ error: "تیکت یافت نشد" }, { status: 404 });

    const { data: messages, error: msgError } = await auth.svc
      .from("support_messages")
      .select("id, author_id, is_staff, body, created_at")
      .eq("ticket_id", params.id)
      .order("created_at", { ascending: true })
      .limit(500);
    if (msgError) throw msgError;

    const names = await resolveNames(
      auth.svc,
      Array.from(new Set((messages ?? []).map((m) => m.author_id as string)))
    );

    /*
      علامت‌زدن خوانده‌شده هنگام باز کردن.

      ⚠️ فقط اگر مجوز پاسخ دارد. ادمینی که فقط می‌خواند نباید نشانگر
      «خوانده‌نشده» را برای تیمی که باید جواب بدهد پاک کند — وگرنه
      تیکت از رادار خارج می‌شود و بی‌جواب می‌ماند.
    */
    const canReply = await hasPermission(auth.svc, auth.userId, "tickets.reply");
    if (canReply && ticket.unread_for_staff) {
      /*
        🔴 حتماً await — سازنده‌ی کوئری Supabase تنبل است و بدون await
        هیچ درخواستی نمی‌فرستد. با `void`، نشانگر «خوانده‌نشده» هرگز
        پاک نمی‌شد. (روی سرور واقعی اندازه‌گیری و تأیید شد.)
      */
      await auth.svc
        .from("support_tickets")
        .update({ staff_read_at: new Date().toISOString() })
        .eq("id", params.id);
    }

    return NextResponse.json({
      ticket: mapTicketRow(ticket),
      canReply,
      messages: (messages ?? []).map((m) => ({
        id: m.id as string,
        isStaff: Boolean(m.is_staff),
        body: m.body as string,
        createdAt: m.created_at as string,
        authorName: names[m.author_id as string] ?? (m.is_staff ? "پشتیبانی" : "کاربر"),
      })),
    });
  } catch (error) {
    return safeError("admin/ticket:GET", error);
  }
}

/** پاسخ تیم پشتیبانی. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const rl = hit(`admin-ticket-reply:${clientIp(request)}`, { limit: 60, windowSeconds: 300 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    if (!isUuid(params.id)) {
      return NextResponse.json({ error: "شناسه نامعتبر" }, { status: 400 });
    }

    const auth = await requirePlatformPermission("tickets.reply");
    if ("response" in auth) return auth.response;

    const parsed = await readJsonBody<{ body?: string }>(request);
    if ("response" in parsed) return parsed.response;

    const body = String(parsed.data.body ?? "").trim();
    const bodyError = validateMessage(body);
    if (bodyError) return NextResponse.json({ error: bodyError }, { status: 400 });

    const { data: ticket } = await auth.svc
      .from("support_tickets")
      .select("id, org_id, subject")
      .eq("id", params.id)
      .maybeSingle();
    if (!ticket) return NextResponse.json({ error: "تیکت یافت نشد" }, { status: 404 });

    /*
      is_staff فرستاده نمی‌شود — تریگر ۰۰۳۶ آن را از روی author_id
      محاسبه می‌کند. اگر اینجا دستی true می‌گذاشتیم، منطق در دو جا
      تکرار می‌شد و روزی از هم جدا می‌افتاد.
    */
    const { error } = await auth.svc.from("support_messages").insert({
      ticket_id: params.id,
      author_id: auth.userId,
      body,
    });
    if (error) throw error;

    /*
      ثبت در گزارش ممیزی.

      پاسخ پشتیبانی «دسترسی به داده‌ی مشتری» است و باید ردپا داشته
      باشد. متن پیام عمداً *ثبت نمی‌شود* — لاگ ممیزی نباید تبدیل به
      کپی دوم داده‌ی مشتری شود؛ خود پیام در جدول تیکت هست.
    */
    await auth.svc.rpc("log_platform_action", {
      p_action: "ticket.replied",
      p_actor: auth.userId,
      p_target_type: "ticket",
      p_target_id: params.id,
      p_target_name: ticket.subject,
      p_reason: null,
      p_meta: { org_id: ticket.org_id, length: body.length },
      p_ip: requestIp(request),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return safeError("admin/ticket:POST", error);
  }
}

/** تغییر وضعیت، اولویت یا ادمین مسئول. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const rl = hit(`admin-ticket-patch:${clientIp(request)}`, { limit: 60, windowSeconds: 300 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    if (!isUuid(params.id)) {
      return NextResponse.json({ error: "شناسه نامعتبر" }, { status: 400 });
    }

    const auth = await requirePlatformPermission("tickets.reply");
    if ("response" in auth) return auth.response;

    const parsed = await readJsonBody<{
      status?: string;
      priority?: string;
      assign_to_me?: boolean;
      unassign?: boolean;
    }>(request);
    if ("response" in parsed) return parsed.response;

    const patch: Record<string, unknown> = {};

    if (parsed.data.status !== undefined) {
      if (!(TICKET_STATUSES as readonly string[]).includes(String(parsed.data.status))) {
        return NextResponse.json({ error: "وضعیت نامعتبر" }, { status: 400 });
      }
      patch.status = parsed.data.status;
      // closed_at باید با وضعیت هماهنگ بماند، وگرنه تیکتِ بازِ
      // «بسته‌شده در تاریخ …» در گزارش‌ها ظاهر می‌شود.
      patch.closed_at = parsed.data.status === "closed" ? new Date().toISOString() : null;
    }

    if (parsed.data.priority !== undefined) {
      if (!(TICKET_PRIORITIES as readonly string[]).includes(String(parsed.data.priority))) {
        return NextResponse.json({ error: "اولویت نامعتبر" }, { status: 400 });
      }
      patch.priority = parsed.data.priority;
    }

    /*
      واگذاری فقط «به خودم» یا «برداشتن».

      انتخاب آزاد ادمین مقصد یعنی باید فهرست ادمین‌ها را به هر کسی که
      مجوز پاسخ دارد نشان دهیم. مدل «برمی‌دارم» ساده‌تر است و همان کار
      را می‌کند: هرکس تیکتی را برمی‌دارد که خودش جواب می‌دهد.
    */
    if (parsed.data.assign_to_me === true) patch.assigned_to = auth.userId;
    if (parsed.data.unassign === true) patch.assigned_to = null;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "تغییری ارسال نشد" }, { status: 400 });
    }

    const { data: before } = await auth.svc
      .from("support_tickets")
      .select("id, subject, status, priority, org_id")
      .eq("id", params.id)
      .maybeSingle();
    if (!before) return NextResponse.json({ error: "تیکت یافت نشد" }, { status: 404 });

    const { error } = await auth.svc
      .from("support_tickets")
      .update(patch)
      .eq("id", params.id);
    if (error) throw error;

    await auth.svc.rpc("log_platform_action", {
      p_action: "ticket.updated",
      p_actor: auth.userId,
      p_target_type: "ticket",
      p_target_id: params.id,
      p_target_name: before.subject,
      p_reason: null,
      p_meta: {
        org_id: before.org_id,
        from: { status: before.status, priority: before.priority },
        to: patch,
      },
      p_ip: requestIp(request),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return safeError("admin/ticket:PATCH", error);
  }
}

type Svc = ReturnType<typeof serviceClient>;

async function hasPermission(
  svc: Svc,
  userId: string,
  permission: string
): Promise<boolean> {
  const { data } = await svc.rpc("platform_admin_can", {
    p_permission: permission,
    p_user: userId,
  });
  return data === true;
}

async function resolveNames(
  svc: Svc,
  userIds: string[]
): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  await Promise.all(
    userIds.map(async (id) => {
      const { data } = await svc.auth.admin.getUserById(id);
      const user = data.user;
      if (!user) return;
      names[id] =
        (user.user_metadata?.name as string | undefined) ||
        displayUsername(user.email) ||
        "کاربر";
    })
  );
  return names;
}
