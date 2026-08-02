import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { roleHasPermission, type Permission } from "@/lib/permissions";

/**
 * گاردهای مشترک روت‌های API.
 *
 * سه مشکلی که در ممیزی پیدا شد و اینجا حل می‌شود:
 *
 *  ۱. نشت پیام خطای داخلی:
 *     روت‌ها `(error as Error).message` را مستقیم به کلاینت می‌فرستادند.
 *     این پیام می‌تواند نام جدول، ستون و ساختار کوئری را لو بدهد.
 *     حالا خطای واقعی در لاگ سرور می‌ماند و کلاینت پیام عمومی می‌گیرد.
 *
 *  ۲. انتخاب تصادفی سازمان:
 *     کد قبلی `.limit(1).single()` بدون ترتیب مشخص بود. کاربری که در دو
 *     سازمان عضو است، ممکن بود داده‌ی سازمان اشتباه را ببیند.
 *     حالا ترتیب قطعی است و پارامتر org_id اختیاری اعتبارسنجی می‌شود.
 *
 *  ۳. تکرار کد احراز هویت در هر روت (احتمال جاافتادن چک در روت جدید).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function serviceClient() {
  if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY تنظیم نشده است");
  return createServiceClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** پاسخ خطای امن: جزئیات فقط در لاگ سرور، پیام عمومی برای کلاینت. */
export function safeError(context: string, error: unknown, status = 500) {
  const id = crypto.randomUUID().slice(0, 8);
  // لاگ سمت سرور برای پیگیری؛ هرگز به کلاینت نمی‌رود.
  console.error(`[${context}][${id}]`, error);
  return NextResponse.json(
    { error: "خطای داخلی سرور. در صورت تکرار با پشتیبانی تماس بگیرید.", ref: id },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });

export const forbidden = () =>
  NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });

export type Membership = {
  org_id: string;
  branch_id: string | null;
  role: string;
};

export type AuthContext = {
  userId: string;
  membership: Membership;
};

/**
 * کاربر واردشده و عضویت فعال او را برمی‌گرداند.
 *
 * `requestedOrgId` اختیاری است: اگر کلاینت سازمان مشخصی خواست، بررسی می‌شود
 * که واقعاً عضو همان سازمان باشد — جلوگیری از IDOR افقی.
 */
export async function requireMember(
  requestedOrgId?: string | null,
  permission?: Permission
): Promise<{ ctx: AuthContext } | { response: NextResponse }> {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { response: unauthorized() };

  // ترتیب قطعی: قدیمی‌ترین عضویت به‌عنوان سازمان پیش‌فرض.
  // (قبلاً بدون order بود و نتیجه غیرقطعی می‌شد.)
  const { data: memberships, error: memError } = await supabase
    .from("memberships")
    .select("org_id, branch_id, role, created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (memError || !memberships || memberships.length === 0) {
    return { response: forbidden() };
  }

  let membership = memberships[0] as Membership;

  if (requestedOrgId) {
    const match = memberships.find((m) => m.org_id === requestedOrgId);
    // کاربر سازمانی را خواسته که عضوش نیست → IDOR
    if (!match) return { response: forbidden() };
    membership = match as Membership;
  }

  if (permission && !roleHasPermission(membership.role as never, permission)) {
    return { response: forbidden() };
  }

  return { ctx: { userId: user.id, membership } };
}

/** بررسی عضویت در platform_admins (پنل سوپرادمین). */
export async function requirePlatformAdmin(): Promise<
  { userId: string; svc: ReturnType<typeof serviceClient> } | { response: NextResponse }
> {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { response: unauthorized() };

  const svc = serviceClient();
  const { data: admin } = await svc
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) return { response: forbidden() };
  return { userId: user.id, svc };
}

/**
 * مثل requirePlatformAdmin، ولی مجوز مشخصی را هم بررسی می‌کند.
 *
 * چرا لازم شد: تا پیش از این هر ادمینی هر کاری می‌توانست بکند —
 * نقش 'support' دقیقاً اختیارات سوپرادمین را داشت. ماتریس مجوز در
 * دیتابیس (تابع platform_admin_can) تک‌منبع حقیقت است تا هر روت
 * تفسیر خودش را نداشته باشد.
 *
 * @param permission یکی از: orgs.view, orgs.approve, orgs.suspend,
 *   trial.extend, plan.change, invoice.view, invoice.modify,
 *   audit.view, admins.manage
 */
export async function requirePlatformPermission(permission: string): Promise<
  | { userId: string; role: string; svc: ReturnType<typeof serviceClient> }
  | { response: NextResponse }
> {
  const auth = await requirePlatformAdmin();
  if ("response" in auth) return auth;

  const { data: allowed, error } = await auth.svc.rpc("platform_admin_can", {
    p_permission: permission,
    p_user: auth.userId,
  });
  // خطای RPC هم یعنی «مجاز نیست» — fail closed.
  if (error || allowed !== true) return { response: forbidden() };

  const { data: role } = await auth.svc.rpc("platform_admin_role", {
    p_user: auth.userId,
  });

  return { userId: auth.userId, role: String(role ?? ""), svc: auth.svc };
}

/**
 * IP درخواست برای ثبت در لاگ ممیزی.
 * پشت پراکسی (Vercel) آدرس واقعی در x-forwarded-for است.
 */
export function requestIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

/* ────────────────── اعتبارسنجی ورودی ────────────────── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_RE.test(value);

/**
 * عدد صحیح در بازه‌ی مشخص؛ ورودی نامعتبر → مقدار پیش‌فرض.
 *
 * توجه: `Number(null)` برابر ۰ و `Number("")` هم ۰ است، نه NaN.
 * بدون بررسی صریحِ null/undefined/رشته‌ی خالی، این مقادیر به `min`
 * کلمپ می‌شدند و پارامتر حذف‌شده به‌جای پیش‌فرض، کمینه می‌گرفت.
 */
export function boundedInt(raw: unknown, min: number, max: number, fallback: number): number {
  if (raw === null || raw === undefined || raw === "") return fallback;
  if (typeof raw !== "number" && typeof raw !== "string") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** تاریخ ISO معتبر یا null — جلوی `new Date("خرابی")` و Invalid Date را می‌گیرد. */
export function safeDate(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 40) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * بدنه‌ی JSON را با سقف حجم می‌خواند.
 * بدون این محدودیت، ارسال یک payload چندمگابایتی حافظه‌ی سرور را می‌بلعد (DoS).
 */
export async function readJsonBody<T = unknown>(
  request: Request,
  maxBytes = 64 * 1024
): Promise<{ data: T } | { response: NextResponse }> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    return {
      response: NextResponse.json({ error: "حجم درخواست بیش از حد مجاز است" }, { status: 413 }),
    };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { response: NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است" }, { status: 400 }) };
  }

  if (text.length > maxBytes) {
    return {
      response: NextResponse.json({ error: "حجم درخواست بیش از حد مجاز است" }, { status: 413 }),
    };
  }

  try {
    return { data: JSON.parse(text) as T };
  } catch {
    return { response: NextResponse.json({ error: "JSON نامعتبر است" }, { status: 400 }) };
  }
}
