/**
 * هویت برند کسب‌وکار — منطق خالص.
 *
 * در `.ts` جداست تا Vitest بتواند بخواندش. اعتبارسنجی فایل لوگو و
 * ساخت مسیر ذخیره دقیقاً همان چیزهایی‌اند که باید تست شوند: اشتباه
 * در مسیر یعنی نشت لوگوی یک کسب‌وکار به کسب‌وکار دیگر.
 */

/** نام سطل ذخیره‌سازی — باید با مهاجرت ۰۰۴۴ یکی بماند. */
export const LOGO_BUCKET = "brand-logos";

/** سقف حجم لوگو (۲ مگابایت) — هم‌تراز با `file_size_limit` سطل. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** فرمت‌های مجاز — هم‌تراز با `allowed_mime_types` سطل. */
export const LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export type BrandIdentity = {
  display_name: string | null;
  logo_url: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  national_id: string | null;
  economic_code: string | null;
  postal_code: string | null;
  invoice_note: string | null;
  slogan: string | null;
};

export const EMPTY_BRAND: BrandIdentity = {
  display_name: null,
  logo_url: null,
  phone: null,
  mobile: null,
  address: null,
  email: null,
  website: null,
  instagram: null,
  national_id: null,
  economic_code: null,
  postal_code: null,
  invoice_note: null,
  slogan: null,
};

/**
 * تبدیل امن خروجی RPC.
 *
 * ⚠️ کلاینت Supabase برای خطای دیتابیس استثنا پرتاب نمی‌کند و ممکن
 * است `null` بدهد. بدون این، `brand.display_name` صفحه‌ی فاکتور را
 * می‌شکست — و فاکتور جایی نیست که بتواند سفید بماند.
 */
export function normalizeBrand(raw: unknown): BrandIdentity {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_BRAND;
  const r = raw as Record<string, unknown>;
  const str = (k: keyof BrandIdentity): string | null => {
    const v = r[k];
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  };
  return {
    display_name: str("display_name"),
    logo_url: str("logo_url"),
    phone: str("phone"),
    mobile: str("mobile"),
    address: str("address"),
    email: str("email"),
    website: str("website"),
    instagram: str("instagram"),
    national_id: str("national_id"),
    economic_code: str("economic_code"),
    postal_code: str("postal_code"),
    invoice_note: str("invoice_note"),
    slogan: str("slogan"),
  };
}

/**
 * مسیر ذخیره‌ی لوگو در سطل.
 *
 * 🔴 پوشه‌ی اول **باید** شناسه‌ی سازمان باشد. سیاست‌های RLS سطل با
 * `(storage.foldername(name))[1]` همین را می‌سنجند؛ اگر ساختار عوض
 * شود، یا آپلود رد می‌شود یا — بدتر — کاربر می‌تواند روی فایل
 * سازمان دیگری بنویسد.
 *
 * مهر زمانی در نام: بدون آن، مرورگر لوگوی قدیمی را از کش نشان می‌داد
 * و کاربر فکر می‌کرد آپلود کار نکرده.
 */
export function logoPath(orgId: string, fileName: string, now: number = Date.now()): string {
  const ext = extensionOf(fileName);
  return `${orgId}/logo-${now}.${ext}`;
}

/** پسوند امن از نام فایل. پیش‌فرض png. */
export function extensionOf(fileName: string): string {
  const m = /\.([a-zA-Z0-9]{1,5})$/.exec(fileName.trim());
  if (!m) return "png";
  const ext = m[1].toLowerCase();
  const allowed = ["png", "jpg", "jpeg", "webp", "svg"];
  return allowed.includes(ext) ? ext : "png";
}

/** خطای اعتبارسنجی فایل، یا null اگر مشکلی نیست. */
export function validateLogoFile(file: { size: number; type: string }): string | null {
  if (!LOGO_MIME_TYPES.includes(file.type)) {
    return "فقط تصویر PNG، JPG، WebP یا SVG پذیرفته می‌شود.";
  }
  if (file.size > LOGO_MAX_BYTES) {
    return "حجم لوگو باید کمتر از ۲ مگابایت باشد.";
  }
  if (file.size === 0) {
    return "فایل خالی است.";
  }
  return null;
}

/**
 * آیا هویت برند به‌اندازه‌ی کافی پر شده که فاکتور حرفه‌ای به‌نظر برسد؟
 *
 * مبنای هشدار «اطلاعات برندتان را کامل کنید». نام تنها کافی نیست —
 * مشتری باید بتواند تماس بگیرد.
 */
export function brandCompleteness(b: BrandIdentity): {
  filled: number;
  total: number;
  missing: string[];
} {
  const KEY_FIELDS: { key: keyof BrandIdentity; label: string }[] = [
    { key: "display_name", label: "نام کسب‌وکار" },
    { key: "logo_url", label: "لوگو" },
    { key: "phone", label: "تلفن" },
    { key: "address", label: "آدرس" },
  ];
  const missing = KEY_FIELDS.filter((f) => !b[f.key]).map((f) => f.label);
  return { filled: KEY_FIELDS.length - missing.length, total: KEY_FIELDS.length, missing };
}

/**
 * نشانی اینستاگرام از نام کاربری.
 *
 * کاربر ممکن است «@shop»، «shop» یا نشانی کامل وارد کند. هر سه باید
 * به یک لینک درست تبدیل شوند.
 */
export function instagramUrl(handle: string | null): string | null {
  if (!handle) return null;
  const t = handle.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  const clean = t.replace(/^@/, "").replace(/^instagram\.com\//i, "");
  if (!clean) return null;
  return `https://instagram.com/${clean}`;
}

/** نام فایل امن برای دانلود — بدون نویسه‌ای که سیستم‌فایل را بشکند. */
export function safeFileName(input: string, fallback = "invoice"): string {
  const cleaned = input
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || fallback;
}

/**
 * شماره‌ی ایرانی را به قالب بین‌المللی واتساپ تبدیل می‌کند.
 *
 * ⚠️ اینجاست و نه در `invoice-share.tsx`، چون Vitest نمی‌تواند JSX
 * از `.tsx` بخواند — همان تله‌ای که قبلاً با `managed-list.helpers.ts`
 * هم خوردیم. منطق خالص همیشه در `.ts`.
 *
 * 🔴 ارقام فارسی اول لاتین می‌شوند. بدون آن، `replace(/\D/g)` همه‌ی
 * ارقام «۰۹۱۲…» را حذف می‌کرد و لینک واتساپ خالی می‌ساخت — یعنی
 * دکمه‌ای که کار نمی‌کند.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = toEnDigitsLocal(String(phone)).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("98")) return digits;
  if (digits.startsWith("0")) return `98${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("9")) return `98${digits}`;
  return digits;
}

/** تبدیل ارقام فارسی/عربی به لاتین — نسخه‌ی محلی تا وابستگی حلقوی نسازد. */
function toEnDigitsLocal(input: string): string {
  return input
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}
