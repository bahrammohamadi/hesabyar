import { NextResponse } from "next/server";
import {
  requireMember,
  serviceClient,
  safeError,
  readJsonBody,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  validateMessage,
  validateSubject,
  type TicketCategory,
  type TicketPriority,
} from "@/lib/support/tickets";

export const dynamic = "force-dynamic";

/**
 * تیکت‌های پشتیبانی — سمت مشتری.
 *
 * چرا از طریق API و نه مستقیم با کلاینت Supabase؟
 *   RLS اجازه‌ی خواندن تیکت‌های سازمان را می‌دهد، ولی نام و ایمیل
 *   نویسنده روی auth.users است و آن جدول به هیچ نقشی SELECT نمی‌دهد.
 *   ضمناً شمارش پیام‌های خوانده‌نشده باید در یک رفت‌وبرگشت بیاید،
 *   نه یک کوئری به ازای هر تیکت.
 */

/** فهرست تیکت‌های سازمان کاربر. */
export async function GET(request: Request) {
  try {
    const rl = hit(`support-list:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const url = new URL(request.url);
    const auth = await requireMember(url.searchParams.get("org_id"));
    if ("response" in auth) return auth.response;
    const { membership, userId } = auth.ctx;

    const svc = serviceClient();
    const { data, error } = await svc
      .from("support_tickets")
      .select(
        "id, subject, status, priority, category, created_at, updated_at, last_message_at, last_message_by, customer_read_at, first_response_at, created_by"
      )
      .eq("org_id", membership.org_id)
      /*
        مرتب‌سازی روی last_message_at، نه created_at: تیکتی که تازه
        پاسخ گرفته باید بالا باشد، حتی اگر هفته‌ی پیش ساخته شده.
        nullsFirst=false چون تیکت بدون پیام (نباید پیش بیاید ولی
        دفاعی) نباید صدر فهرست را بگیرد.
      */
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    const ids = (data ?? []).map((t) => t.id as string);
    const counts = await messageCounts(svc, ids);

    return NextResponse.json({
      tickets: (data ?? []).map((t) => ({
        id: t.id as string,
        subject: t.subject as string,
        status: t.status as string,
        priority: t.priority as string,
        category: (t.category as string) ?? "other",
        createdAt: t.created_at as string,
        lastMessageAt: (t.last_message_at as string) ?? null,
        lastMessageBy: (t.last_message_by as string) ?? null,
        customerReadAt: (t.customer_read_at as string) ?? null,
        firstResponseAt: (t.first_response_at as string) ?? null,
        messageCount: counts[t.id as string] ?? 0,
        // آیا خودِ این کاربر تیکت را ساخته؟ در سازمان چندنفره مهم است.
        isMine: t.created_by === userId,
      })),
    });
  } catch (error) {
    return safeError("support/tickets:GET", error);
  }
}

/** تیکت جدید + اولین پیام. */
export async function POST(request: Request) {
  try {
    /*
      سقف سخت‌گیرانه: تیکت به ما ایمیل/اعلان می‌دهد و ساختن انبوه آن
      هم ما را غرق می‌کند و هم دیتابیس مشتری را. ۵ تیکت در ۱۰ دقیقه
      برای هر استفاده‌ی واقعی بیش از کافی است.
    */
    const rl = hit(`support-new:${clientIp(request)}`, {
      limit: 5,
      windowSeconds: 600,
      blockSeconds: 600,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const parsed = await readJsonBody<Record<string, unknown>>(request);
    if ("response" in parsed) return parsed.response;

    const auth = await requireMember(
      typeof parsed.data.org_id === "string" ? parsed.data.org_id : null
    );
    if ("response" in auth) return auth.response;
    const { membership, userId } = auth.ctx;

    const subject = String(parsed.data.subject ?? "").trim();
    const body = String(parsed.data.body ?? "").trim();

    const subjectError = validateSubject(subject);
    if (subjectError) return NextResponse.json({ error: subjectError }, { status: 400 });
    const bodyError = validateMessage(body);
    if (bodyError) return NextResponse.json({ error: bodyError }, { status: 400 });

    /*
      فهرست سفید برای دسته و اولویت.

      🔴 بدون این، مقدار دلخواه به قید CHECK دیتابیس می‌رسید و خطای خام
      Postgres به کاربر برمی‌گشت — هم زشت است و هم نام ستون و قید را
      لو می‌دهد.
    */
    const category: TicketCategory = TICKET_CATEGORIES.includes(
      parsed.data.category as TicketCategory
    )
      ? (parsed.data.category as TicketCategory)
      : "other";
    const priority: TicketPriority = TICKET_PRIORITIES.includes(
      parsed.data.priority as TicketPriority
    )
      ? (parsed.data.priority as TicketPriority)
      : "normal";

    const svc = serviceClient();

    /*
      ⚠️ تیکت باز تکراری.

      کاربری که جواب نمی‌گیرد همان سؤال را دوباره می‌فرستد و صف
      پشتیبانی پر از تیکت تکراری می‌شود. سقف ۱۰ تیکت باز هم‌زمان برای
      هر سازمان، بدون اینکه جلوی استفاده‌ی واقعی را بگیرد، این را
      محدود می‌کند.
    */
    const { count: openCount } = await svc
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("org_id", membership.org_id)
      .in("status", ["open", "pending"]);

    if ((openCount ?? 0) >= 10) {
      return NextResponse.json(
        {
          error:
            "شما ۱۰ تیکت باز دارید. لطفاً پیام جدید را در یکی از تیکت‌های باز بفرستید یا تیکت‌های حل‌شده را ببندید.",
        },
        { status: 429 }
      );
    }

    const { data: ticket, error } = await svc
      .from("support_tickets")
      .insert({
        org_id: membership.org_id,
        created_by: userId,
        subject,
        category,
        priority,
      })
      .select("id")
      .single();
    if (error) throw error;

    /*
      اولین پیام.

      is_staff فرستاده نمی‌شود — تریگر مهاجرت ۰۰۳۶ خودش از روی
      author_id محاسبه‌اش می‌کند. ارسال آن از کلاینت یعنی امکان جعل
      پیام «از طرف پشتیبانی».
    */
    const { error: msgError } = await svc.from("support_messages").insert({
      ticket_id: ticket.id,
      author_id: userId,
      body,
    });
    if (msgError) {
      /*
        تیکت بدون پیام یعنی ادمین موضوعی می‌بیند که هیچ توضیحی ندارد.
        چون Supabase تراکنش چندمرحله‌ای از REST نمی‌دهد، دستی پاک
        می‌کنیم.
      */
      await svc.from("support_tickets").delete().eq("id", ticket.id);
      throw msgError;
    }

    return NextResponse.json({ ok: true, id: ticket.id });
  } catch (error) {
    return safeError("support/tickets:POST", error);
  }
}

/** شمارش پیام هر تیکت در یک کوئری — جلوگیری از N+1. */
async function messageCounts(
  svc: ReturnType<typeof serviceClient>,
  ticketIds: string[]
): Promise<Record<string, number>> {
  if (ticketIds.length === 0) return {};
  const { data } = await svc
    .from("support_messages")
    .select("ticket_id")
    .in("ticket_id", ticketIds);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = row.ticket_id as string;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}
