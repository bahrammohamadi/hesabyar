/**
 * واحد شمارش کالا: شمارشی، وزنی، حجمی، طولی — و واحد فرعی (بسته/کارتن).
 *
 * چرا فایل `.ts` جدا؟ Vitest نمی‌تواند JSX از `.tsx` بخواند و این
 * محاسبات مستقیم روی موجودی انبار و مبلغ فاکتور اثر می‌گذارند.
 *
 * 🔴 مشکلی که حل می‌کند: ستون `qty` از نوع `integer` بود. «۱٫۵ کیلو
 * گوشت» یا «۲۵۰ گرم آرد» اصلاً قابل ثبت نبود.
 */

/** نوع واحد شمارش. با محدودیت `products_unit_check` در دیتابیس یکی است. */
export type UnitKind = "count" | "weight" | "volume" | "length";

export const UNIT_KINDS: UnitKind[] = ["count", "weight", "volume", "length"];

/** برچسب فارسی و واحد پیش‌فرض هر نوع. */
export const UNIT_META: Record<UnitKind, { label: string; defaultUnit: string; step: number }> = {
  count: { label: "شمارشی", defaultUnit: "عدد", step: 1 },
  weight: { label: "وزنی", defaultUnit: "کیلوگرم", step: 0.001 },
  volume: { label: "حجمی", defaultUnit: "لیتر", step: 0.001 },
  length: { label: "طولی", defaultUnit: "متر", step: 0.01 },
};

/** آیا این واحد مقدار اعشاری می‌پذیرد؟ */
export function allowsFraction(unit: UnitKind): boolean {
  return unit !== "count";
}

/**
 * برچسبی که کنار مقدار نشان داده می‌شود.
 *
 * برچسب دلخواه کاربر («بسته»، «تخته») بر پیش‌فرض مقدم است.
 */
export function unitLabel(unit: UnitKind, customLabel?: string | null): string {
  const trimmed = (customLabel ?? "").trim();
  if (trimmed) return trimmed;
  return UNIT_META[unit]?.defaultUnit ?? "عدد";
}

/**
 * مقدار وارد‌شده را به مقدار مجاز آن واحد گرد می‌کند.
 *
 * 🔴 کالای شمارشی نباید ۲٫۵ عدد بپذیرد. اگر نگیریمش، در فاکتور
 * «۲٫۵ عدد پیراهن» ثبت می‌شود و انبار برای همیشه نیم‌عددی می‌ماند.
 *
 * ⚠️ سه رقم اعشار سقف است — همان `numeric(14,3)` دیتابیس. اگر
 * بیشتر بپذیریم، عددی که کاربر می‌بیند با آنچه ذخیره می‌شود فرق
 * می‌کند.
 */
export function normalizeQty(raw: number, unit: UnitKind): number {
  if (!Number.isFinite(raw)) return 0;
  const positive = Math.max(0, raw);
  if (unit === "count") return Math.round(positive);
  // گرد کردن به سه رقم بدون خطای ممیز شناور.
  return Math.round(positive * 1000) / 1000;
}

/**
 * تبدیل تعداد بسته به تعداد واحد اصلی.
 *
 * ⚠️ باید با `pack_to_base` در مهاجرت ۰۰۴۸ یکی بماند.
 *
 * بسته‌ی تعریف‌نشده ضریب یک دارد، نه صفر: اگر صفر برمی‌گرداندیم،
 * کاربری که «۳ کارتن» زده بود ناگهان صفر عدد در فاکتور می‌دید.
 */
export function packToBase(packs: number, packSize?: number | null): number {
  const p = Number.isFinite(packs) ? packs : 0;
  if (!packSize || packSize <= 0) return p;
  return Math.round(p * packSize * 1000) / 1000;
}

/** تبدیل معکوس: تعداد واحد اصلی به بسته. برای نمایش «۳۶ عدد = ۳ کارتن». */
export function baseToPack(base: number, packSize?: number | null): number {
  const b = Number.isFinite(base) ? base : 0;
  if (!packSize || packSize <= 0) return b;
  return Math.round((b / packSize) * 1000) / 1000;
}

/**
 * قیمت هر واحد اصلی، وقتی کاربر قیمت را برای **بسته** وارد کرده.
 *
 * 🔴 چرا لازم است: تأمین‌کننده «کارتن ۱۲تایی، ۲۴۰ هزار تومان» می‌دهد.
 * اگر همان ۲۴۰ هزار را قیمت واحد بگیریم، بهای تمام‌شده ۱۲ برابر
 * می‌شود و گزارش سود کاملاً غلط از آب درمی‌آید.
 */
export function packPriceToUnitPrice(packPriceRial: number, packSize?: number | null): number {
  const price = Math.max(0, packPriceRial || 0);
  if (!packSize || packSize <= 0) return price;
  return Math.round(price / packSize);
}

/**
 * مقدار را برای نمایش قالب‌بندی می‌کند.
 *
 * صفرهای بی‌معنی حذف می‌شوند: «۱٫۵۰۰ کیلوگرم» بد است، «۱٫۵ کیلوگرم»
 * درست. ولی «۲ عدد» نباید «۲٫۰» شود.
 *
 * ⚠️ ارقام فارسی اینجا اعمال **نمی‌شود** — این تابع خالص است و
 * تبدیل رقم کار لایه‌ی نمایش است.
 */
export function formatQty(qty: number, unit: UnitKind): string {
  const value = normalizeQty(qty, unit);
  if (unit === "count") return String(Math.round(value));
  // toFixed(3) بعد حذف صفرهای انتهایی و ممیز تنها
  return value.toFixed(3).replace(/\.?0+$/, "");
}

/**
 * آیا مقدار برای این واحد معتبر است؟ پیام خطا برمی‌گرداند یا null.
 *
 * جدا از `normalizeQty` است چون گاهی می‌خواهیم به کاربر **بگوییم**
 * چه اشتباهی کرده نه اینکه بی‌صدا اصلاحش کنیم.
 */
export function validateQty(raw: number, unit: UnitKind): string | null {
  if (!Number.isFinite(raw)) return "مقدار معتبر نیست";
  if (raw <= 0) return "مقدار باید بزرگ‌تر از صفر باشد";
  if (unit === "count" && !Number.isInteger(raw)) {
    return "این کالا شمارشی است و مقدار اعشاری نمی‌پذیرد";
  }
  if (Math.round(raw * 1000) / 1000 !== raw) {
    return "حداکثر سه رقم اعشار مجاز است";
  }
  return null;
}

/**
 * مبلغ یک سطر با مقدار اعشاری.
 *
 * 🔴 چرا تابع جدا و نه ضرب ساده؟ `1.5 * 33333` می‌شود
 * `49999.499999999996`. بدون گرد کردن صریح، جمع فاکتور با جمع
 * سطرها یک ریال اختلاف پیدا می‌کند و کاربر فکر می‌کند برنامه
 * حساب بلد نیست.
 */
export function lineTotalRial(unitPriceRial: number, qty: number, unit: UnitKind): number {
  const price = Math.max(0, unitPriceRial || 0);
  const amount = normalizeQty(qty, unit);
  return Math.round(price * amount);
}
