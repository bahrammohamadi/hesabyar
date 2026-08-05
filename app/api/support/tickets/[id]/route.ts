import { NextResponse } from "next/server";
import {
  requireMember,
  serviceClient,
  safeError,
  isUuid,
  readJsonBody,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { displayUsername } from "@/lib/utils/format";
import { validateMessage } from "@/lib/support/tickets";

export const dynamic = "force-dynamic";

/**
 * یک تیکت + نخ گفتگو — سمت مشتری.
 *
 * 🔴 نکته‌ی امنیتی محوری این فایل:
 *   شناسه‌ی تیکت از URL می‌آید و کوئری‌ها با کلید service_role اجرا
 *   می‌شوند، یعنی RLS دور زده می‌شود. پس *هر* مسیر باید صریحاً
 *   `org_id` را با سازمان کاربر بسنجد. یک بار جاافتادن این شرط یعنی
 *   هر مشتری با عوض‌کردن UUID، گفتگوی پشتیبانی کسب‌وکار دیگری را
 *   می‌خواند.
 *
 *   الگوی به‌کاررفته: شرط سازمان داخل خودِ WHERE، نه یک `if` جداگانه
 *   بعد از خواندن. اینطور «فراموش‌کردن بررسی» به نتیجه‌ی خالی ختم
 *   می‌شود، نه به نشت داده.
 */

async function loadOwnedTicket(id: string, orgId: string) {
  const svc = serviceClient();
  const { data, error } = await svc
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)   // ← گارد IDOR، داخل کوئری
    .maybeSingle();
  if (error) throw error;
  return { svc, ticket: data };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const rl = hit(`support-detail:${clientIp(request)}`, { limit: 120, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    if (!isUuid(params.id)) {
      return NextResponse.json({ error: "شناسه نامعتبر" }, { status: 400 });
    }

    const auth = await requireMember();
    if ("response" in auth) return auth.response;
    const { membership, userId } = auth.ctx;

    const { svc, ticket } = await loadOwnedTicket(params.id, membership.org_id);
    // تیکت متعلق به سازمان دیگر و تیکت ناموجود، پاسخ یکسان می‌گیرند —
    // وگرنه تفاوت پاسخ‌ها وجود تیکت را لو می‌دهد.
    if (!ticket) return NextResponse.json({ error: "تیکت یافت نشد" }, { status: 404 });

    const { data: messages, error: msgError } = await svc
      .from("support_messages")
      .select("id, author_id, is_staff, body, created_at")
      .eq("ticket_id", params.id)
      .order("created_at", { ascending: true })
      .limit(500);
    if (msgError) throw msgError;

    const authorNames = await resolveNames(
      svc,
      Array.from(new Set((messages ?? []).map((m) => m.author_id as string)))
    );

    /*
      علامت‌زدن «خوانده‌شده» هنگام *باز کردن*.

      چرا اینجا و نه هنگام بستن صفحه؟ رویداد بستن صفحه روی موبایل
      قابل اتکا نیست (تب کشته می‌شود، درخواست نمی‌رسد) و نشانگر
      خوانده‌نشده برای همیشه می‌ماند. همین درس در زنگوله‌ی اعلان‌ها
      هم گرفته شد.

      فقط وقتی به‌روزرسانی می‌شود که واقعاً چیز تازه‌ای هست — تا
      هر بار باز کردن یک UPDATE بی‌فایده نزند.

      🔴 اینجا حتماً باید await شود.
      نسخه‌ی اول `void svc.from(...).update(...)` بود، با این تصور که
      «عملیات جانبی نباید پاسخ را کند کند». ولی سازنده‌ی کوئری
      Supabase یک thenable تنبل است: تا زمانی که await (یا .then)
      نشود، هیچ درخواستی به شبکه نمی‌رود. `void` فقط مقدار را دور
      می‌اندازد و اجرا هرگز شروع نمی‌شود.

      نتیجه‌ی اندازه‌گیری‌شده روی سرور واقعی: پس از باز کردن گفتگو،
      `customer_read_at` دست‌نخورده ماند و نشان «پاسخ جدید» برای همیشه
      روی تیکت می‌ماند. با await، مقدار بلافاصله ثبت می‌شود.

      ⚠️ همین اشتباه در روت ادمین هم بود و همان‌جا هم اصلاح شد.
    */
    const needsRead =
      ticket.last_message_by === "staff" &&
      (!ticket.customer_read_at ||
        new Date(ticket.last_message_at) > new Date(ticket.customer_read_at));
    if (needsRead) {
      await svc
        .from("support_tickets")
        .update({ customer_read_at: new Date().toISOString() })
        .eq("id", params.id)
        .eq("org_id", membership.org_id);
    }

    return NextResponse.json({
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category ?? "other",
        createdAt: ticket.created_at,
        firstResponseAt: ticket.first_response_at ?? null,
        closedAt: ticket.closed_at ?? null,
        isMine: ticket.created_by === userId,
      },
      messages: (messages ?? []).map((m) => ({
        id: m.id as string,
        isStaff: Boolean(m.is_staff),
        body: m.body as string,
        createdAt: m.created_at as string,
        authorName: m.is_staff
          ? "تیم پشتیبانی ترازو"
          : authorNames[m.author_id as string] ?? "کاربر",
        isSelf: m.author_id === userId,
      })),
    });
  } catch (error) {
    return safeError("support/ticket:GET", error);
  }
}

/** ارسال پاسخ در تیکت. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const rl = hit(`support-reply:${clientIp(request)}`, { limit: 20, windowSeconds: 300 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    if (!isUuid(params.id)) {
      return NextResponse.json({ error: "شناسه نامعتبر" }, { status: 400 });
    }

    const parsed = await readJsonBody<{ body?: string }>(request);
    if ("response" in parsed) return parsed.response;

    const auth = await requireMember();
    if ("response" in auth) return auth.response;
    const { membership, userId } = auth.ctx;

    const body = String(parsed.data.body ?? "").trim();
    const bodyError = validateMessage(body);
    if (bodyError) return NextResponse.json({ error: bodyError }, { status: 400 });

    const { svc, ticket } = await loadOwnedTicket(params.id, membership.org_id);
    if (!ticket) return NextResponse.json({ error: "تیکت یافت نشد" }, { status: 404 });

    /*
      تیکت بسته پیام نمی‌گیرد.

      تریگر دیتابیس تیکت بسته را با پیام مشتری دوباره باز می‌کند، ولی
      آن رفتار برای مسیرهای داخلی است. در UI بهتر است کاربر صریحاً
      «بازکردن دوباره» را بزند تا بداند چه اتفاقی می‌افتد.
    */
    if (ticket.status === "closed") {
      return NextResponse.json(
        { error: "این تیکت بسته شده است. برای ادامه، ابتدا آن را دوباره باز کنید." },
        { status: 409 }
      );
    }

    const { error } = await svc.from("support_messages").insert({
      ticket_id: params.id,
      author_id: userId,
      body,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return safeError("support/ticket:POST", error);
  }
}

/** بستن یا بازکردن دوباره‌ی تیکت توسط مشتری. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const rl = hit(`support-patch:${clientIp(request)}`, { limit: 30, windowSeconds: 300 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    if (!isUuid(params.id)) {
      return NextResponse.json({ error: "شناسه نامعتبر" }, { status: 400 });
    }

    const parsed = await readJsonBody<{ status?: string }>(request);
    if ("response" in parsed) return parsed.response;

    const auth = await requireMember();
    if ("response" in auth) return auth.response;
    const { membership } = auth.ctx;

    // مشتری فقط این دو حالت را دارد؛ resolved/pending تصمیم پشتیبانی است.
    const next = parsed.data.status;
    if (next !== "closed" && next !== "open") {
      return NextResponse.json({ error: "وضعیت نامعتبر" }, { status: 400 });
    }

    const { svc, ticket } = await loadOwnedTicket(params.id, membership.org_id);
    if (!ticket) return NextResponse.json({ error: "تیکت یافت نشد" }, { status: 404 });

    const { error } = await svc
      .from("support_tickets")
      .update({
        status: next,
        closed_at: next === "closed" ? new Date().toISOString() : null,
      })
      .eq("id", params.id)
      .eq("org_id", membership.org_id);
    if (error) throw error;

    return NextResponse.json({ ok: true, status: next });
  } catch (error) {
    return safeError("support/ticket:PATCH", error);
  }
}

/** نام نمایشی نویسندگان — یک بار برای همه، نه یکی‌یکی. */
async function resolveNames(
  svc: ReturnType<typeof serviceClient>,
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
