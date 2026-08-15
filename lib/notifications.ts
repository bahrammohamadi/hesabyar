/**
 * منطق خالص اعلان‌ها.
 *
 * در `.ts` جداست تا Vitest بتواند بخواندش — تشخیص پشتیبانی پوش و
 * دسته‌بندی اعلان دقیقاً همان چیزهایی‌اند که باید تست شوند، چون
 * اشتباهشان یعنی دکمه‌ای که وعده می‌دهد و کار نمی‌کند.
 */

/** نوع اعلان‌های کسب‌وکار — هم‌تراز با CHECK در مهاجرت ۰۰۴۵. */
export type NotificationKind =
  | "check_due"
  | "check_overdue"
  | "debt_reminder"
  | "crm_followup"
  | "low_stock"
  | "order_pending"
  | "payment_received"
  | "system";

export type BusinessNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  priority: "normal" | "high";
  read_at: string | null;
  created_at: string;
};

export const NOTIFICATION_LABEL: Record<NotificationKind, string> = {
  check_due: "سررسید چک",
  check_overdue: "چک معوق",
  debt_reminder: "بدهی مشتری",
  crm_followup: "پیگیری مشتری",
  low_stock: "کسری کالا",
  order_pending: "سفارش در انتظار",
  payment_received: "دریافت وجه",
  system: "سیستم",
};

/** خالیِ امن. */
export function normalizeNotifications(raw: unknown): BusinessNotification[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (n): n is BusinessNotification =>
      !!n && typeof n === "object" && typeof (n as { id?: unknown }).id === "string"
  );
}

/** شمار خوانده‌نشده‌ها. */
export function unreadCount(list: BusinessNotification[]): number {
  return list.filter((n) => !n.read_at).length;
}

/* ------------------------------------------------------------------ */
/* پشتیبانی پوش روی دستگاه                                             */
/* ------------------------------------------------------------------ */

export type PushSupport =
  /** همه‌چیز آماده است؛ می‌شود اجازه گرفت. */
  | "ready"
  /** iOS است ولی هنوز روی صفحه‌ی اصلی نصب نشده. */
  | "ios-needs-install"
  /** مرورگر اصلاً Push API ندارد. */
  | "unsupported"
  /** کاربر قبلاً رد کرده — باید از تنظیمات مرورگر برگرداند. */
  | "denied"
  /** از قبل فعال است. */
  | "granted";

/**
 * آیا می‌شود پوش را فعال کرد؟
 *
 * 🔴 مهم‌ترین شرط، iOS است. تحقیق تأیید کرد:
 *   • پوش وب روی آیفون فقط از iOS 16.4 به بعد
 *   • و **فقط** وقتی برنامه از «صفحه‌ی اصلی» باز شده باشد
 *   • در تب معمولی سافاری `PushManager` اصلاً وجود ندارد
 *
 * پس روی آیفونِ نصب‌نشده نباید دکمه‌ی «فعال‌سازی» نشان بدهیم؛ باید
 * اول راهنمای نصب بدهیم. دکمه‌ای که بزنند و کار نکند، بدتر از
 * نبودنش است — همان درسی که از دکمه‌ی ورود صوتی گرفتیم.
 */
export function resolvePushSupport(input: {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: "default" | "granted" | "denied";
  ios: boolean;
  standalone: boolean;
}): PushSupport {
  // iOS نصب‌نشده: حتی اگر API موجود باشد، اشتراک شکست می‌خورد.
  if (input.ios && !input.standalone) return "ios-needs-install";
  if (!input.hasServiceWorker || !input.hasPushManager || !input.hasNotification) {
    return "unsupported";
  }
  if (input.permission === "denied") return "denied";
  if (input.permission === "granted") return "granted";
  return "ready";
}

/** پیام فارسی متناسب با هر وضعیت. */
export function pushSupportMessage(s: PushSupport): string {
  switch (s) {
    case "ios-needs-install":
      return "برای دریافت اعلان روی آیفون، اول برنامه را به صفحه‌ی اصلی اضافه کنید و از همان‌جا بازش کنید.";
    case "unsupported":
      return "مرورگر شما اعلان روی دستگاه را پشتیبانی نمی‌کند.";
    case "denied":
      return "اعلان‌ها را قبلاً رد کرده‌اید. برای فعال‌سازی باید از تنظیمات مرورگر اجازه بدهید.";
    case "granted":
      return "اعلان روی این دستگاه فعال است.";
    default:
      return "با فعال‌سازی، سررسید چک و یادآوری‌ها را روی گوشی می‌گیرید.";
  }
}

/**
 * تبدیل کلید VAPID از base64url به Uint8Array.
 *
 * ⚠️ `PushManager.subscribe` فقط `Uint8Array` می‌پذیرد و رشته را رد
 * می‌کند. base64url هم با base64 استاندارد فرق دارد: `-` و `_`
 * به‌جای `+` و `/`، و بدون padding. بدون این تبدیل، اشتراک با خطای
 * مبهم `InvalidCharacterError` شکست می‌خورد.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  /*
    ⚠️ بافر صریح ساخته می‌شود و نوع خروجی `Uint8Array<ArrayBuffer>` است.
    `Uint8Array` ساده در TypeScript جدید ممکن است روی `SharedArrayBuffer`
    باشد و `applicationServerKey` آن را نمی‌پذیرد — خطای نوعی که موقع
    ساخت گرفتیم.
  */
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/* ------------------------------------------------------------------ */
/* یادداشت انتشار — فیلتر «فقط مهم‌ها»                                 */
/* ------------------------------------------------------------------ */

/**
 * آیا این نسخه ارزش نشان‌دادن در زنگوله را دارد؟
 *
 * 🔴 مسئله‌ای که کاربر گزارش کرد: «نیازی نیست همه آپدیت‌ها بیاد تو
 * نوتیفیکیشن بار».
 *
 * شمارش واقعی: ۲۷ نسخه با ۱۰۹ تغییر، که ۳۴ تای آن «رفع اشکال» جزئی
 * است. کاربر برای دیدن یک خبر مهم باید از ده تا «چسبیدن تاریخ در
 * فهرست پرداخت» رد شود، پس زنگوله را اصلاً باز نمی‌کند.
 *
 * قاعده: نسخه فقط وقتی در زنگوله می‌آید که `important: true` داشته
 * باشد. بقیه در صفحه‌ی «تاریخچه‌ی نسخه‌ها» می‌مانند و گم نمی‌شوند.
 */
export function isImportantRelease(r: { important?: boolean }): boolean {
  return r.important === true;
}

/**
 * آیا کلید VAPID معتبر به‌نظر می‌رسد؟
 *
 * 🔴 باگی که واقعاً رخ داد: کلید عمومی را در Vercel به‌صورت
 * `encrypted` ثبت کردم. `NEXT_PUBLIC_*` در باندل کلاینت می‌نشیند و
 * Vercel مقدار رمزشده (`eyJ2IjoidjIi…`) را جای کلید گذاشت. نتیجه
 * این بود که `subscribe` بی‌صدا شکست می‌خورد بدون هیچ پیام روشنی.
 *
 * کلید عمومی VAPID همیشه base64url از ۶۵ بایت است ⇒ ۸۷ نویسه.
 * هر چیز دیگری یعنی پیکربندی غلط، و بهتر است زود و با صدای بلند
 * معلوم شود.
 */
export function looksLikeVapidKey(key: string | undefined | null): boolean {
  if (!key) return false;
  const k = key.trim();
  if (k.length < 80 || k.length > 100) return false;
  // مقدار رمزشده‌ی Vercel همیشه با این پیشوند شروع می‌شود.
  if (k.startsWith("eyJ")) return false;
  return /^[A-Za-z0-9_-]+$/.test(k);
}
