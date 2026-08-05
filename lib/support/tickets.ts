/**
 * ثابت‌های مشترک تیکت پشتیبانی.
 *
 * چرا یک فایل مشترک و نه تعریف در هر صفحه؟
 *   برچسب‌ها در چهار جا استفاده می‌شوند: صفحه‌ی مشتری، صفحه‌ی ادمین،
 *   روت API (برای اعتبارسنجی) و تست. تعریف جداگانه یعنی روزی یکی
 *   عوض می‌شود و بقیه جا می‌مانند — همان دسته باگی که در ماتریس
 *   مجوز دو بار تکرار شد.
 *
 * ⚠️ مقادیر باید دقیقاً با قیدهای CHECK در مهاجرت ۰۰۳۶ یکی باشند.
 * یک تست این هم‌خوانی را از روی خود فایل SQL بررسی می‌کند.
 */

export const TICKET_STATUSES = ["open", "pending", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["low", "normal", "high"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_CATEGORIES = ["technical", "billing", "feature", "data", "other"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

/**
 * برچسب وضعیت از **دید مشتری**.
 *
 * عمداً با دید ادمین فرق دارد. برای ادمین `pending` یعنی «پاسخ داده‌ام،
 * منتظر مشتری‌ام»؛ اگر همین کلمه را به مشتری نشان دهیم، «در انتظار»
 * را «هنوز کسی نگاه نکرده» می‌فهمد و دوباره تیکت می‌زند.
 */
export const TICKET_STATUS_CUSTOMER: Record<TicketStatus, { label: string; tone: BadgeTone }> = {
  open:     { label: "در انتظار پاسخ", tone: "warning" },
  pending:  { label: "پاسخ داده شد",   tone: "info" },
  resolved: { label: "حل شد",          tone: "success" },
  closed:   { label: "بسته شده",       tone: "neutral" },
};

/** برچسب وضعیت از دید تیم پشتیبانی. */
export const TICKET_STATUS_STAFF: Record<TicketStatus, { label: string; tone: BadgeTone }> = {
  open:     { label: "نیازمند پاسخ",   tone: "danger" },
  pending:  { label: "منتظر مشتری",    tone: "info" },
  resolved: { label: "حل شده",         tone: "success" },
  closed:   { label: "بسته شده",       tone: "neutral" },
};

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, { label: string; tone: BadgeTone }> = {
  low:    { label: "کم",    tone: "neutral" },
  normal: { label: "عادی",  tone: "info" },
  high:   { label: "فوری",  tone: "danger" },
};

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  technical: "مشکل فنی",
  billing:   "صورتحساب و اشتراک",
  feature:   "درخواست قابلیت",
  data:      "داده و گزارش",
  other:     "سایر",
};

/** راهنمای زیر هر دسته — کاربر بدون آن همه‌چیز را «سایر» می‌زند. */
export const TICKET_CATEGORY_HINT: Record<TicketCategory, string> = {
  technical: "صفحه‌ای باز نمی‌شود، خطا می‌دهد یا کند است",
  billing:   "پرداخت، تمدید یا تغییر پلن",
  feature:   "قابلیتی که دوست دارید اضافه شود",
  data:      "عدد گزارشی درست نیست یا داده‌ای گم شده",
  other:     "هر چیز دیگر",
};

/* ─────────────── محدودیت‌های ورودی ─────────────── */
/*
  در یک جا تعریف می‌شوند تا پیام خطای UI با چیزی که سرور واقعاً رد
  می‌کند یکی باشد. اختلافشان یعنی کاربر متنی می‌نویسد که فرم قبول
  می‌کند ولی سرور برمی‌گرداند.
*/
export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 200;
export const MESSAGE_MIN = 5;
export const MESSAGE_MAX = 4000;

export function validateSubject(raw: string): string | null {
  const value = raw.trim();
  if (value.length < SUBJECT_MIN) return "موضوع را کامل‌تر بنویسید (حداقل ۳ نویسه).";
  if (value.length > SUBJECT_MAX) return "موضوع بیش از حد طولانی است.";
  return null;
}

export function validateMessage(raw: string): string | null {
  const value = raw.trim();
  if (value.length < MESSAGE_MIN) return "متن پیام را بنویسید (حداقل ۵ نویسه).";
  if (value.length > MESSAGE_MAX) return "متن پیام بیش از حد طولانی است.";
  return null;
}

/**
 * آیا این تیکت برای مشتری پیام خوانده‌نشده دارد؟
 *
 * منطق در یک جا نوشته می‌شود چون هم زنگوله و هم فهرست از آن استفاده
 * می‌کنند؛ دو پیاده‌سازی یعنی نشانگر و فهرست با هم اختلاف پیدا کنند.
 */
export function hasUnreadForCustomer(ticket: {
  lastMessageAt: string | null;
  lastMessageBy: string | null;
  customerReadAt: string | null;
}): boolean {
  if (ticket.lastMessageBy !== "staff" || !ticket.lastMessageAt) return false;
  if (!ticket.customerReadAt) return true;
  return new Date(ticket.lastMessageAt) > new Date(ticket.customerReadAt);
}

/**
 * زمان نسبی فارسی («۳ ساعت پیش»).
 *
 * چرا در کنار تاریخ شمسی و نه به‌جای آن؟
 *   در گفتگو، «۵ دقیقه پیش» بلافاصله می‌فهماند که طرف مقابل آنلاین
 *   است؛ «۱۴۰۵/۰۵/۱۴ ساعت ۱۰:۲۳» این را نمی‌رساند. ولی برای پیام
 *   قدیمی برعکس است، پس بعد از یک هفته به تاریخ کامل برمی‌گردیم.
 */
export function relativeFa(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;

  const diff = Math.floor((now - t) / 1000);
  // ساعت کاربر ممکن است جلو باشد؛ «۳- دقیقه پیش» نباید دیده شود.
  if (diff < 0) return "لحظاتی پیش";
  if (diff < 60) return "لحظاتی پیش";

  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins} دقیقه پیش`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ساعت پیش`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} روز پیش`;

  return null; // فراتر از یک هفته → تاریخ کامل شمسی نمایش داده می‌شود
}

/**
 * تبدیل ردیف `v_support_tickets` به شکل مورد استفاده‌ی UI.
 *
 * ⚠️ چرا اینجا و نه کنار روت؟
 *   فایل‌های `route.ts` در Next.js فقط اجازه‌ی export نام‌های شناخته‌شده
 *   (GET/POST/dynamic/…) را دارند. نسخه‌ی اول این تابع از خودِ روت
 *   export می‌شد؛ `tsc --noEmit` تمیز رد شد ولی `next build` شکست:
 *     «"mapTicket" is not a valid Route export field»
 *   یعنی type-check تنها، اثبات درستی نیست.
 */
export function mapTicketRow(r: Record<string, unknown>) {
  return {
    id: r.id as string,
    orgId: (r.org_id as string) ?? null,
    orgName: (r.org_name as string) ?? "—",
    ownerName: (r.owner_full_name as string) ?? null,
    creatorEmail: (r.creator_email as string) ?? null,
    creatorName: (r.creator_name as string) ?? null,
    subject: r.subject as string,
    status: r.status as string,
    priority: r.priority as string,
    category: (r.category as string) ?? "other",
    assignedTo: (r.assigned_to as string) ?? null,
    assigneeEmail: (r.assignee_email as string) ?? null,
    createdAt: r.created_at as string,
    lastMessageAt: (r.last_message_at as string) ?? null,
    lastMessageBy: (r.last_message_by as string) ?? null,
    firstResponseAt: (r.first_response_at as string) ?? null,
    closedAt: (r.closed_at as string) ?? null,
    messageCount: Number(r.message_count ?? 0),
    unread: r.unread_for_staff === true,
  };
}

/**
 * میانگین زمان اولین پاسخ بر حسب ساعت.
 *
 * فقط تیکت‌هایی که *پاسخ گرفته‌اند* شمرده می‌شوند. اگر تیکت‌های بی‌پاسخ
 * را با صفر وارد می‌کردیم، میانگین بهتر از واقعیت نشان داده می‌شد —
 * دقیقاً برعکس چیزی که این عدد باید هشدار بدهد.
 */
export function averageFirstResponseHours(
  rows: { first_response_at?: unknown; created_at?: unknown }[]
): number | null {
  const answered = rows.filter((r) => r.first_response_at);
  if (answered.length === 0) return null;
  const totalMs = answered.reduce(
    (sum, r) =>
      sum +
      (new Date(r.first_response_at as string).getTime() -
        new Date(r.created_at as string).getTime()),
    0
  );
  return Math.round((totalMs / answered.length / 3_600_000) * 10) / 10;
}
