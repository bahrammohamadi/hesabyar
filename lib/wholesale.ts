/**
 * منطق فروش عمده: پلکان قیمت، اعتبار مشتری و آمادگی تبدیل پیش‌فاکتور.
 *
 * چرا فایل `.ts` جدا و نه داخل کامپوننت؟ Vitest نمی‌تواند JSX از
 * `.tsx` بخواند، و این محاسبات دقیقاً همان‌هایی‌اند که باید تست شوند —
 * اشتباه در آن‌ها مستقیم روی قیمتی می‌نشیند که به مشتری داده می‌شود.
 *
 * ⚠️ همه‌ی مبالغ **ریال** هستند (واحد دیتابیس).
 *
 * 🔴 هر تابع اینجا باید با همتای SQL خود در مهاجرت ۰۰۴۷ **دقیقاً** یکی
 * بماند. اگر از هم جدا بیفتند، عددی که کاربر پیش از ثبت می‌بیند با
 * آنچه ذخیره می‌شود فرق می‌کند — و آن بدترین نوع باگ است چون کسی
 * متوجهش نمی‌شود تا وقتی مشتری اعتراض کند.
 */

/** یک پله‌ی قیمت. دقیقاً یکی از `unit_price` یا `discount_percent` پر است. */
export type PriceTier = {
  id?: string;
  /** خالی یعنی پله روی همه‌ی کالاهای لیست اعمال می‌شود. */
  variant_id: string | null;
  min_qty: number;
  unit_price: number | null;
  discount_percent: number | null;
  is_active?: boolean;
};

/**
 * پله‌ی برنده برای یک کالا و تعداد مشخص.
 *
 * 🔴 چرا `min_qty` تنها و نه بازه‌ی min..max؟
 *   بازه‌ی دوسر «حفره» می‌سازد: کاربر ۱-۹ و ۲۰-۵۰ تعریف می‌کند و
 *   تعداد ۱۵ به هیچ پله‌ای نمی‌خورد. آن‌وقت قیمت بی‌صدا به حالت پایه
 *   برمی‌گردد و فروشنده تا آخر ماه نمی‌فهمد چرا حاشیه‌ی سودش پرید.
 *   با `min_qty` تنها، همیشه بزرگ‌ترین پله‌ای که <= تعداد است برنده
 *   می‌شود و حفره از نظر ریاضی ممکن نیست.
 *
 * اولویت: پله‌ی مخصوص همان کالا بر پله‌ی عمومی مقدم است — حتی اگر
 * `min_qty` عمومی بزرگ‌تر باشد. دلیلش این است که تعریف اختصاصی یک
 * تصمیم آگاهانه‌ی کاربر درباره‌ی همان کالاست.
 */
export function pickTier(
  tiers: PriceTier[],
  variantId: string,
  qty: number
): PriceTier | null {
  const q = Math.max(1, Math.floor(qty) || 1);

  const eligible = tiers.filter(
    (t) =>
      t.is_active !== false &&
      t.min_qty <= q &&
      (t.variant_id === variantId || t.variant_id === null)
  );
  if (eligible.length === 0) return null;

  const specific = eligible.filter((t) => t.variant_id === variantId);
  const pool = specific.length > 0 ? specific : eligible;

  return pool.reduce((best, t) => (t.min_qty > best.min_qty ? t : best));
}

/**
 * قیمت مؤثر یک واحد، با توجه به تعداد.
 *
 * ترتیب اولویت — از خاص به عام، همان ترتیب `tier_price_for` در SQL:
 *   ۱) پله‌ی مخصوص کالا
 *   ۲) پله‌ی عمومی لیست
 *   ۳) قیمت اختصاصی کالا در لیست
 *   ۴) درصد تخفیف عمومی لیست
 *   ۵) قیمت پایه‌ی کالا
 */
export function tierPriceRial(input: {
  basePriceRial: number;
  qty: number;
  tiers?: PriceTier[];
  variantId: string;
  /** قیمت اختصاصی همین کالا در لیست، اگر تعریف شده باشد. */
  explicitPriceRial?: number | null;
  /** درصد تخفیف عمومی خود لیست. */
  listDiscountPercent?: number | null;
}): number {
  const base = Math.max(0, input.basePriceRial || 0);

  const tier = pickTier(input.tiers ?? [], input.variantId, input.qty);
  if (tier) {
    if (tier.unit_price !== null && tier.unit_price !== undefined) {
      return Math.max(0, Math.round(tier.unit_price));
    }
    const pct = clampPercent(tier.discount_percent ?? 0);
    return Math.max(0, Math.round((base * (100 - pct)) / 100));
  }

  if (typeof input.explicitPriceRial === "number") {
    return Math.max(0, Math.round(input.explicitPriceRial));
  }

  const listPct = clampPercent(input.listDiscountPercent ?? 0);
  return Math.max(0, Math.round((base * (100 - listPct)) / 100));
}

/** درصد را در بازه‌ی ۰..۱۰۰ نگه می‌دارد. ورودی خراب صفر می‌شود، نه NaN. */
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * پله‌ی بعدی که هنوز به آن نرسیده‌ایم — برای پیام «۳ عدد دیگر بگیر،
 * ۱۲٪ ارزان‌تر می‌شود».
 *
 * این همان کاری است که فروشنده‌ی حرفه‌ای شفاهی انجام می‌دهد و
 * بزرگ‌ترین اهرم افزایش سبد در فروش عمده است. هیچ‌کدام از رقبا آن را
 * به ویزیتور **نشان نمی‌دهند** — فقط قیمت را اعمال می‌کنند.
 */
export function nextTierHint(input: {
  basePriceRial: number;
  qty: number;
  tiers?: PriceTier[];
  variantId: string;
  explicitPriceRial?: number | null;
  listDiscountPercent?: number | null;
}): { addQty: number; atQty: number; newPriceRial: number; savingPerUnitRial: number } | null {
  const q = Math.max(1, Math.floor(input.qty) || 1);
  const tiers = (input.tiers ?? []).filter(
    (t) =>
      t.is_active !== false &&
      t.min_qty > q &&
      (t.variant_id === input.variantId || t.variant_id === null)
  );
  if (tiers.length === 0) return null;

  // نزدیک‌ترین پله‌ی بالاتر، نه بهترین قیمت: پیشنهادی که ۵۰۰ عدد
  // بخواهد برای کسی که ۳ تا می‌خرد فقط آزاردهنده است.
  const next = tiers.reduce((best, t) => (t.min_qty < best.min_qty ? t : best));

  const current = tierPriceRial(input);
  const upgraded = tierPriceRial({ ...input, qty: next.min_qty });

  // پله‌ای که ارزان‌تر نیست پیشنهاد نمی‌شود. کاربر ممکن است پله‌ی
  // گران‌تر تعریف کرده باشد (اشتباه یا عمدی)؛ در هر صورت تبلیغش غلط است.
  if (upgraded >= current) return null;

  return {
    addQty: next.min_qty - q,
    atQty: next.min_qty,
    newPriceRial: upgraded,
    savingPerUnitRial: current - upgraded,
  };
}

/* ------------------------------------------------------------------ */
/* اعتبار مشتری                                                        */
/* ------------------------------------------------------------------ */

export type CreditStatus = {
  creditLimitRial: number;
  balanceRial: number;
  /** null یعنی سقف تعریف نشده. */
  remainingRial: number | null;
  overLimit: boolean;
  /** با احتساب فاکتور در حال ثبت. */
  wouldExceed: boolean;
};

/**
 * وضعیت اعتبار مشتری، با احتساب مبلغ نسیه‌ی فاکتور در دست ثبت.
 *
 * 🔴 `contacts.credit_limit` از مهاجرت ۰۰۰۱ وجود دارد و **هرگز در
 * هیچ کجای برنامه خوانده نشده بود** — نه در فروش، نه در سفارش. صفر
 * مشتری از ۵۵۲ مشتری مقدار دارد.
 *
 * ⚠️ سقف صفر یعنی «تعریف نشده» نه «ممنوع». اگر صفر را ممنوع می‌گرفتیم،
 * با اولین دیپلوی همه‌ی مشتریان موجود یک‌شبه مسدود می‌شدند و کاربر
 * فکر می‌کرد برنامه خراب شده.
 */
export function creditStatus(input: {
  creditLimitRial: number;
  balanceRial: number;
  pendingCreditRial?: number;
}): CreditStatus {
  const limit = Math.max(0, input.creditLimitRial || 0);
  const balance = input.balanceRial || 0;
  const pending = Math.max(0, input.pendingCreditRial || 0);
  const hasLimit = limit > 0;

  return {
    creditLimitRial: limit,
    balanceRial: balance,
    remainingRial: hasLimit ? limit - balance : null,
    overLimit: hasLimit && balance > limit,
    wouldExceed: hasLimit && balance + pending > limit,
  };
}

/* ------------------------------------------------------------------ */
/* تبدیل پیش‌فاکتور                                                    */
/* ------------------------------------------------------------------ */

/** وضعیت‌هایی که تبدیل به فاکتور از آن‌ها ممکن است. */
export const CONVERTIBLE_STATUSES = ["pending", "confirmed"] as const;

/**
 * آیا این پیش‌فاکتور قابل تبدیل است؟
 *
 * ⚠️ این فقط برای **غیرفعال‌کردن دکمه** است. گارد واقعی در
 * `convert_order_to_sale` است که قفل ردیف می‌گیرد. اگر فقط به این
 * تکیه می‌کردیم، دو تب باز یعنی دو فاکتور و دو بار کم‌شدن موجودی.
 */
export function canConvertOrder(order: {
  status: string;
  converted_to_id?: string | null;
  itemCount?: number;
}): { ok: boolean; reason?: string } {
  if (order.converted_to_id) {
    return { ok: false, reason: "این پیش‌فاکتور قبلاً به فاکتور تبدیل شده است" };
  }
  if (order.status === "converted") {
    return { ok: false, reason: "این پیش‌فاکتور قبلاً به فاکتور تبدیل شده است" };
  }
  if (order.status === "cancelled") {
    return { ok: false, reason: "پیش‌فاکتور لغو شده قابل تبدیل نیست" };
  }
  if (order.itemCount !== undefined && order.itemCount <= 0) {
    return { ok: false, reason: "پیش‌فاکتور هیچ قلمی ندارد" };
  }
  return { ok: true };
}

/**
 * آیا پیش‌فاکتور منقضی شده؟
 *
 * ⚠️ فقط **تاریخ** مقایسه می‌شود نه لحظه. اگر ساعت را هم حساب
 * می‌کردیم، پیش‌فاکتوری که «تا امروز» اعتبار دارد از ساعت ۰۰:۰۰ همان
 * روز منقضی به‌نظر می‌رسید — یعنی کاربر یک روز کامل را از دست می‌داد.
 */
export function isOrderExpired(expiryDate: string | null | undefined, now = new Date()): boolean {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return false;
  const endOfExpiryDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate(), 23, 59, 59, 999);
  return now.getTime() > endOfExpiryDay.getTime();
}
