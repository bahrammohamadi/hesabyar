/**
 * سابقه‌ی ورود — منطق خالص نمایش.
 *
 * چرا فایل جدا؟ تشخیص «رویداد مشکوک» یک قضاوت امنیتی است و باید
 * مستقل تست شود. اشتباه در آن یعنی یا هشدار الکی (کاربر بی‌اعتماد
 * می‌شود و دیگر نگاه نمی‌کند) یا سکوت در برابر نفوذ واقعی.
 *
 * ⚠️ هیچ وابستگی به `node:` ندارد — این فایل از کامپوننت کلاینت هم
 * خوانده می‌شود. همان درسی که با `node:crypto` گرفتیم.
 */

/** انواع رویدادی که در `login_events` ثبت می‌شوند. */
export type LoginEventType = "success" | "failure" | "throttled" | "reset" | "mfa_failure";

export type LoginEvent = {
  event: LoginEventType | string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

/** برچسب فارسی و لحن رنگی هر رویداد. */
export const EVENT_META: Record<
  LoginEventType,
  { label: string; tone: "success" | "danger" | "warning" | "info" }
> = {
  success: { label: "ورود موفق", tone: "success" },
  failure: { label: "رمز اشتباه", tone: "danger" },
  throttled: { label: "مسدود موقت", tone: "warning" },
  reset: { label: "بازیابی رمز", tone: "info" },
  mfa_failure: { label: "کد دومرحله‌ای اشتباه", tone: "danger" },
};

export function eventMeta(event: string) {
  return (
    EVENT_META[event as LoginEventType] ?? { label: event, tone: "info" as const }
  );
}

/**
 * آیا این رویداد باید توجه کاربر را جلب کند؟
 *
 * ⚠️ عمداً محافظه‌کارانه است. «ورود موفق از دستگاه جدید» هشدار
 * **نیست** — کاربر روی گوشی و لپ‌تاپ و تبلت وارد می‌شود و اگر هر
 * بار علامت قرمز ببیند، خیلی زود یاد می‌گیرد نادیده‌اش بگیرد. آن‌وقت
 * هشدار واقعی هم گم می‌شود.
 */
export function isNoteworthy(event: string): boolean {
  return event === "failure" || event === "throttled" || event === "mfa_failure";
}

/**
 * خلاصه‌ی وضعیت برای نمایش بالای فهرست.
 *
 * 🔴 چرا «تلاش ناموفق در ۲۴ ساعت» و نه کل تاریخچه؟
 *   کاربری که سه ماه پیش رمزش را اشتباه زده مهم نیست. آنچه اهمیت
 *   دارد فعالیت **اخیر** است. با شمردن کل تاریخچه، عدد همیشه بزرگ
 *   می‌ماند و بی‌معنا می‌شود.
 */
export function summarize(events: LoginEvent[], now = new Date()) {
  const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;

  let recentFailures = 0;
  let lastSuccessAt: string | null = null;
  const ips = new Set<string>();

  for (const e of events) {
    const t = new Date(e.created_at).getTime();
    const fresh = Number.isFinite(t) && t >= dayAgo;

    if (fresh && isNoteworthy(e.event)) recentFailures++;
    if (e.event === "success") {
      if (!lastSuccessAt || new Date(e.created_at) > new Date(lastSuccessAt)) {
        lastSuccessAt = e.created_at;
      }
      if (e.ip) ips.add(e.ip);
    }
  }

  return {
    total: events.length,
    recentFailures,
    lastSuccessAt,
    /* تعداد نشانی‌های متفاوتی که ورود موفق از آن‌ها انجام شده. */
    distinctIps: ips.size,
  };
}

/**
 * پوشاندن بخش پایانی نشانی اینترنتی.
 *
 * 🔴 چرا: نشانی کامل در صفحه‌ای که ممکن است کسی از پشت سر ببیند،
 * اطلاعات اضافه‌ای می‌دهد بی‌آنکه به کاربر کمکی کند. برای تشخیص
 * «این من بودم یا نه؟» سه بخش اول کافی است.
 *
 * ⚠️ IPv6 هم پشتیبانی می‌شود؛ بدون آن، آدرس‌های جدید خام می‌ماندند.
 */
export function maskIp(ip: string | null | undefined): string {
  const clean = (ip ?? "").trim();
  if (!clean) return "نامشخص";

  if (clean.includes(":")) {
    const parts = clean.split(":").filter(Boolean);
    if (parts.length <= 2) return `${parts[0] ?? ""}:···`;
    return `${parts[0]}:${parts[1]}:···`;
  }

  const parts = clean.split(".");
  if (parts.length !== 4) return clean;
  return `${parts[0]}.${parts[1]}.${parts[2]}.···`;
}
