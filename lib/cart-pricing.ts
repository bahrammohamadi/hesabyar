/**
 * محاسبات قیمت و تخفیف هر قلم در سبد فروش و خرید.
 *
 * چرا فایل `.ts` جدا؟ Vitest نمی‌تواند JSX از `.tsx` بخواند و این
 * محاسبات دقیقاً همان چیزی‌اند که باید تست شوند — اشتباه در آن‌ها
 * مستقیم روی پول کاربر اثر می‌گذارد.
 *
 * ⚠️ همه‌ی مبالغ **ریال** هستند (واحد دیتابیس). تبدیل به تومان فقط
 * در لایه‌ی نمایش انجام می‌شود.
 */

/** حالت ورود تخفیف هر قلم. */
export type LineDiscountMode = "amount" | "percent";

/**
 * تخفیف یک قلم بر حسب ریال.
 *
 * در حالت درصدی، مبنا **مبلغ کل همان سطر** است (قیمت × تعداد)، نه
 * قیمت واحد. اگر روی قیمت واحد حساب می‌کردیم، «۱۰٪ تخفیف» روی سه
 * عدد کالا فقط یک‌سوم انتظار کاربر را کم می‌کرد.
 *
 * تخفیف هرگز از مبلغ سطر بیشتر نمی‌شود — وگرنه جمع فاکتور منفی
 * می‌شد و `create_sale` سند بی‌معنا ثبت می‌کرد.
 */
export function lineDiscountRial(
  unitPriceRial: number,
  qty: number,
  mode: LineDiscountMode,
  rawValue: number
): number {
  const lineTotal = Math.max(0, unitPriceRial) * Math.max(0, qty);
  if (lineTotal <= 0) return 0;

  const value = Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0;

  if (mode === "percent") {
    const pct = Math.min(100, value);
    return Math.round((lineTotal * pct) / 100);
  }
  return Math.min(Math.round(value), lineTotal);
}

/** مبلغ نهایی یک سطر پس از تخفیف. هرگز منفی نمی‌شود. */
export function lineNetRial(unitPriceRial: number, qty: number, discountRial: number): number {
  const gross = Math.max(0, unitPriceRial) * Math.max(0, qty);
  return Math.max(0, gross - Math.max(0, discountRial));
}

/**
 * تبدیل تخفیف ریالی به درصد معادل — برای نمایش هنگام جابه‌جایی حالت.
 *
 * وقتی کاربر از «مبلغ» به «درصد» سوئیچ می‌کند، عدد داخل کادر باید
 * همان تخفیف فعلی را نشان بدهد نه صفر؛ وگرنه تخفیفی که قبلاً داده
 * بی‌صدا پاک می‌شود.
 */
export function discountRialToPercent(
  unitPriceRial: number,
  qty: number,
  discountRial: number
): number {
  const lineTotal = Math.max(0, unitPriceRial) * Math.max(0, qty);
  if (lineTotal <= 0) return 0;
  return Math.round((Math.max(0, discountRial) / lineTotal) * 100);
}

/**
 * درصد سود بر مبنای قیمت خرید.
 *
 * قیمت خرید صفر یعنی تقسیم بر صفر؛ در آن حالت صفر برمی‌گردانیم نه
 * Infinity. (کالای هدیه یا نمونه قیمت خرید صفر دارد.)
 */
export function marginPercent(purchaseRial: number, saleRial: number): number {
  if (purchaseRial <= 0) return 0;
  return Math.round(((saleRial - purchaseRial) / purchaseRial) * 100);
}

/**
 * قیمت فروش از روی درصد سود.
 *
 * 🔴 این همان چیزی است که کاربر خواست: «عدد ۳ یا ۱۰ را می‌زنم، دکمه
 * را می‌زنم، به درصد تبدیل می‌کند». یعنی کاربر درصد را وارد می‌کند و
 * سیستم قیمت فروش را می‌سازد — نه برعکس. فروشنده معمولاً می‌گوید
 * «۴۰ درصد رویش بکش»، نه اینکه عدد نهایی را از قبل بداند.
 */
export function saleFromMargin(purchaseRial: number, percent: number): number {
  const pct = Number.isFinite(percent) ? percent : 0;
  return Math.max(0, Math.round(purchaseRial * (1 + pct / 100)));
}

/* ------------------------------------------------------------------ */
/* تغییر قیمت به‌صورت درصدی — خواسته‌ی «قیمت هم مثل تخفیف درصد داشته باشد» */
/* ------------------------------------------------------------------ */

/**
 * قیمت جدید از روی درصد تغییر نسبت به **قیمت پایه‌ی کالا**.
 *
 * قیمت پایه یعنی همان قیمتی که کالا با آن وارد سبد شد (قیمت فروش
 * ثبت‌شده در کارت کالا، یا قیمت خرید در سند خرید) — نه قیمت فعلیِ
 * ویرایش‌شده.
 *
 * 🔴 چرا پایه و نه قیمت فعلی؟
 *   اگر مبنا قیمت فعلی بود، زدن «۱۰» دو بار پشت‌سرهم قیمت را ۲۱٪
 *   بالا می‌برد نه ۱۰٪ — و کاربر که فقط می‌خواست عدد را اصلاح کند،
 *   با هر تصحیح یک پله دورتر می‌شد. با مبنای ثابت، ورود «۱۰» همیشه
 *   همان یک نتیجه را می‌دهد و قابل بازگشت است (صفر = قیمت اصلی).
 *
 * درصد منفی مجاز است: «۱۰-» یعنی ده درصد ارزان‌تر. سقف پایین صفر
 * است تا قیمت منفی ساخته نشود.
 */
export function priceFromPercent(basePriceRial: number, percent: number): number {
  const base = Math.max(0, basePriceRial);
  const pct = Number.isFinite(percent) ? percent : 0;
  return Math.max(0, Math.round(base * (1 + pct / 100)));
}

/**
 * درصد تغییر قیمت فعلی نسبت به قیمت پایه — برای نمایش هنگام تعویض حالت.
 *
 * پایه‌ی صفر (کالای هدیه) تقسیم بر صفر می‌شود؛ در آن حالت صفر
 * برمی‌گردانیم نه Infinity.
 */
export function percentFromPrice(basePriceRial: number, priceRial: number): number {
  const base = Math.max(0, basePriceRial);
  if (base <= 0) return 0;
  return Math.round(((Math.max(0, priceRial) - base) / base) * 100);
}

/* ------------------------------------------------------------------ */
/* سرشکن هزینه‌های جانبی روی قیمت تمام‌شده                              */
/* ------------------------------------------------------------------ */

/** روش پخش هزینه‌های جانبی بین اقلام فاکتور خرید. */
export type AllocationMode = "by_value" | "by_qty";

/**
 * سهم یک قلم از هزینه‌های جانبی (کرایه حمل، باربری، بسته‌بندی).
 *
 * 🔴 چرا لازم شد: `p_extra_total` فقط به جمع فاکتور اضافه می‌شد و
 * روی `purchase_price` کالا نمی‌نشست. چون `sale_items.cost_price` از
 * همان می‌آید، سود هر فروش به‌اندازه‌ی سهم آن کالا از هزینه‌ی حمل
 * **بیشتر** گزارش می‌شد.
 *
 * ⚠️ باید دقیقاً با `allocate_extra_cost` در مهاجرت ۰۰۴۶ یکی بماند.
 * اگر از هم جدا بیفتند، عددی که کاربر پیش از ثبت می‌بیند با آنچه
 * ذخیره می‌شود فرق می‌کند.
 *
 * دو روش، هر دو رایج:
 *   by_value → بیمه و کارمزد بانکی (به نسبت ارزش)
 *   by_qty   → کرایه‌ی حمل (کامیون به تعداد کارتن کار دارد)
 */
export function allocateExtraCost(input: {
  extraRial: number;
  lineNetRial: number;
  lineQty: number;
  totalNetRial: number;
  totalQty: number;
  mode?: AllocationMode;
}): number {
  const extra = Math.max(0, input.extraRial || 0);
  if (extra <= 0) return 0;

  const mode = input.mode ?? "by_value";

  /*
    🔴 همه‌ی ورودی‌ها به صفر کف می‌خورند.

    تست سختگیرانه‌تر یک باگ واقعی پیدا کرد: با `lineNetRial` منفی
    (ورودی خراب از کلاینت) سهم منفی برمی‌گشت، یعنی قیمت تمام‌شده
    **کمتر** از قیمت خرید می‌شد و سود دوباره غلط گزارش می‌شد.

    نسخه‌ی اول فقط `extraRial` را کف می‌زد.
  */
  const lineNet = Math.max(0, input.lineNetRial || 0);
  const lineQty = Math.max(0, input.lineQty || 0);
  const totalNet = Math.max(0, input.totalNetRial || 0);
  const totalQty = Math.max(0, input.totalQty || 0);

  /*
    اگر ارزش کل صفر باشد (همه‌ی اقلام رایگان، مثل نمونه یا هدیه)
    تقسیم بر صفر می‌شد. در آن حالت به by_qty برمی‌گردیم که همیشه
    مخرج مثبت دارد.
  */
  if (mode === "by_qty" || totalNet <= 0) {
    if (totalQty <= 0) return 0;
    return Math.round((extra * lineQty) / totalQty);
  }
  return Math.round((extra * lineNet) / totalNet);
}

/**
 * قیمت تمام‌شده‌ی هر **واحد**.
 *
 * ⚠️ واحدی است نه کل سطر. `cost_price` در `sale_items` هم واحدی است
 * و اگر کل سطر را بگذاریم، سود کالاهای چندتایی چند برابر غلط می‌شود.
 */
export function landedUnitCost(lineNetRial: number, shareRial: number, qty: number): number {
  if (qty <= 0) return 0;
  return Math.round((Math.max(0, lineNetRial) + Math.max(0, shareRial)) / qty);
}
