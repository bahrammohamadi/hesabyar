/**
 * منطق خالص «کارهای امروز».
 *
 * در `.ts` جداست تا Vitest بتواند بخواندش — دسته‌بندی فوریت و شمارش
 * دقیقاً همان چیزهایی‌اند که باید تست شوند، چون اشتباهشان یعنی کاربر
 * یک چک سررسیدگذشته را نمی‌بیند.
 *
 * ⚠️ همه‌ی مبالغ **ریال**اند (واحد دیتابیس). تبدیل به تومان فقط در
 * لایه‌ی نمایش.
 */

export type CheckRow = {
  id: string;
  /** received = چک دریافتی از مشتری · issued = چک صادرشده توسط ما */
  type: "received" | "issued";
  check_no: string | null;
  bank_name: string | null;
  amount: number;
  due_date: string;
  contact_name: string | null;
};

export type UnpaidInvoiceRow = {
  id: string;
  invoice_no: string | null;
  date: string;
  amount: number;
  contact_name: string | null;
  days_old: number;
};

export type OutOfStockRow = {
  variant_id: string;
  product_id: string | null;
  product_name: string;
  label: string | null;
  stock_qty: number;
  sold_qty: number;
};

export type PendingOrderRow = {
  id: string;
  order_no: string | null;
  date: string;
  total: number;
  contact_name: string | null;
};

export type ActionCenterData = {
  checks_overdue: CheckRow[];
  checks_soon: CheckRow[];
  unpaid_invoices: UnpaidInvoiceRow[];
  out_of_stock: OutOfStockRow[];
  pending_orders: PendingOrderRow[];
};

/** خالیِ امن — وقتی هنوز داده نیامده یا سازمان انتخاب نشده. */
export const EMPTY_ACTION_CENTER: ActionCenterData = {
  checks_overdue: [],
  checks_soon: [],
  unpaid_invoices: [],
  out_of_stock: [],
  pending_orders: [],
};

/**
 * ورودی خام RPC را به شکل امن تبدیل می‌کند.
 *
 * ⚠️ چرا لازم است: کلاینت Supabase برای خطای دیتابیس استثنا پرتاب
 * نمی‌کند و ممکن است `null` برگرداند. بدون این تابع، `data.checks_overdue.length`
 * کل داشبورد را می‌شکست.
 */
export function normalizeActionCenter(raw: unknown): ActionCenterData {
  if (!raw || typeof raw !== "object") return EMPTY_ACTION_CENTER;
  const r = raw as Record<string, unknown>;
  const arr = <T,>(key: string): T[] => (Array.isArray(r[key]) ? (r[key] as T[]) : []);
  return {
    checks_overdue: arr<CheckRow>("checks_overdue"),
    checks_soon: arr<CheckRow>("checks_soon"),
    unpaid_invoices: arr<UnpaidInvoiceRow>("unpaid_invoices"),
    out_of_stock: arr<OutOfStockRow>("out_of_stock"),
    pending_orders: arr<PendingOrderRow>("pending_orders"),
  };
}

/** جمع کل کارهای باز — عدد روی نشان (badge). */
export function totalActionCount(d: ActionCenterData): number {
  return (
    d.checks_overdue.length +
    d.checks_soon.length +
    d.unpaid_invoices.length +
    d.out_of_stock.length +
    d.pending_orders.length
  );
}

/** درجه‌ی فوریت یک گروه — رنگ و ترتیب از این می‌آید. */
export type Urgency = "danger" | "warning" | "info";

/**
 * فوریت هر گروه.
 *
 * ترتیب عمدی است و از منطق کسب‌وکار می‌آید نه سلیقه:
 *   • چک سررسیدگذشته → خطر. چک برگشتی عواقب قانونی دارد.
 *   • چک نزدیک و کالای تمام‌شده → هشدار. هنوز وقت هست.
 *   • فاکتور نسیه و سفارش → اطلاع. مهم‌اند ولی فوری نیستند.
 */
export function groupUrgency(key: keyof ActionCenterData): Urgency {
  if (key === "checks_overdue") return "danger";
  if (key === "checks_soon" || key === "out_of_stock") return "warning";
  return "info";
}

/**
 * فاصله‌ی روز تا سررسید. منفی یعنی گذشته.
 *
 * ⚠️ هر دو تاریخ به نیمه‌شب محلی گرد می‌شوند. بدون این، چکی که امروز
 * ساعت ۹ صبح سررسید شده «۱- روز» نشان داده می‌شد در حالی که کاربر
 * انتظار «امروز» دارد.
 */
export function daysUntil(due: string | Date, now: Date = new Date()): number {
  const d = due instanceof Date ? due : new Date(due);
  if (Number.isNaN(d.getTime())) return 0;
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

/** متن فارسی فاصله‌ی سررسید — بدون رقم لاتین. */
export function dueLabel(days: number, faDigits: (n: number | string) => string): string {
  if (days === 0) return "امروز";
  if (days === 1) return "فردا";
  if (days > 1) return `${faDigits(days)} روز دیگر`;
  if (days === -1) return "دیروز";
  return `${faDigits(Math.abs(days))} روز گذشته`;
}

/**
 * آیا این فاکتور نسیه واقعاً کهنه است؟
 *
 * ۳۰ روز مرز عرفی «معوق» در خرده‌فروشی ایران است. زیر آن، نسیه‌ی
 * عادی است و نشان‌دادنش به‌عنوان مشکل، اعتماد کاربر به هشدارها را
 * از بین می‌برد — همان اشتباهی که در «موجودی کم» رخ داد.
 */
export const STALE_INVOICE_DAYS = 30;

export function isStaleInvoice(daysOld: number): boolean {
  return daysOld >= STALE_INVOICE_DAYS;
}
