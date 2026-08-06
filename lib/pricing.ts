/**
 * قیمت مؤثر یک کالا — منبع واحد حقیقت.
 *
 * 🔴 مسئله‌ای که حل می‌کند (گزارش کاربر با مثال «شومیز کتیبه»):
 *
 *   در فهرست کالاها قیمت فروش درست نشان داده می‌شد، ولی هنگام افزودن
 *   همان کالا به فاکتور، عدد دیگری می‌آمد. دلیلش دو منطق متفاوت در
 *   دو فایل بود:
 *
 *     فهرست کالاها  →  base_sale_price || variant.sale_price || 0
 *     انتخابگر کالا →  variant.sale_price ?? base_sale_price ?? 0
 *
 *   یعنی **ترتیب اولویت برعکس بود**. تا وقتی هر دو مقدار یکی باشند
 *   کسی متوجه نمی‌شود؛ به‌محض اینکه از هم جدا شوند، دو صفحه دو عدد
 *   نشان می‌دهند.
 *
 *   داده‌ی واقعی هنگام بررسی:
 *     شومیز کتیبه → base_sale_price = ۱۵٬۹۰۰٬۰۰۰ ریال
 *                   variant.sale_price = ۹۷۰٬۰۰۰ ریال
 *   فهرست ۱٬۵۹۰٬۰۰۰ تومان می‌گفت و فاکتور ۹۷٬۰۰۰ تومان.
 *
 * 🔴 و اینکه *کدام* درست است:
 *
 *   قیمت واریانت. چون یک کالا می‌تواند در چند رنگ یا سایز قیمت
 *   متفاوت داشته باشد و `base_sale_price` فقط «پیش‌فرض هنگام ساخت»
 *   است. فاکتور — که پول واقعی جابه‌جا می‌کند — همیشه از واریانت
 *   می‌خواند. پس فهرست باید خودش را با فاکتور هماهنگ کند، نه برعکس.
 *
 *   ⚠️ عمداً هیچ داده‌ای در دیتابیس اصلاح نمی‌شود. اینکه واریانتی
 *   قیمتش با پایه فرق دارد ممکن است تصمیم آگاهانه‌ی کاربر باشد.
 *   کاری که می‌کنیم این است که همه‌جا *یک* عدد نشان دهیم و اختلاف را
 *   به کاربر گزارش کنیم تا خودش تصمیم بگیرد.
 */

export interface PricedVariant {
  sale_price?: number | null;
  purchase_price?: number | null;
}

export interface PricedProduct {
  base_sale_price?: number | null;
  base_purchase_price?: number | null;
}

/**
 * قیمت فروش مؤثر یک واریانت (ریال).
 *
 * ترتیب: قیمت خود واریانت → قیمت پایه‌ی کالا → صفر.
 *
 * ⚠️ `??` استفاده می‌شود نه `||`.
 *   با `||` قیمت صفر (که مقدار معتبری است — کالای هدیه یا نمونه)
 *   رد می‌شد و به قیمت پایه می‌افتاد. تفاوت «قیمت ندارد» با «قیمتش
 *   صفر است» باید حفظ شود.
 */
export function effectiveSalePrice(
  variant: PricedVariant | null | undefined,
  product: PricedProduct | null | undefined
): number {
  return variant?.sale_price ?? product?.base_sale_price ?? 0;
}

/** قیمت خرید مؤثر (ریال). همان قاعده. */
export function effectivePurchasePrice(
  variant: PricedVariant | null | undefined,
  product: PricedProduct | null | undefined
): number {
  return variant?.purchase_price ?? product?.base_purchase_price ?? 0;
}

/**
 * قیمت نمایشی یک کالا در فهرست، وقتی چند واریانت دارد.
 *
 * چرا جدا از `effectiveSalePrice`؟
 *   در فهرست، *کالا* نشان داده می‌شود نه یک واریانت خاص. اگر
 *   واریانت‌ها قیمت‌های متفاوت داشته باشند، نشان‌دادن یکی از آن‌ها
 *   گمراه‌کننده است — کاربر فکر می‌کند قیمت همین است و بعد در فاکتور
 *   عدد دیگری می‌بیند. همان باگی که گزارش شد.
 *
 * پس:
 *   • یک واریانت یا همه هم‌قیمت → همان عدد
 *   • قیمت‌های متفاوت → کمینه، با پرچم `mixed` تا UI بتواند
 *     «از … » نشان دهد
 */
export function listDisplayPrice(
  product: PricedProduct | null | undefined,
  variants: PricedVariant[] | null | undefined
): { price: number; mixed: boolean } {
  const list = variants ?? [];
  if (list.length === 0) {
    return { price: product?.base_sale_price ?? 0, mixed: false };
  }

  const prices = list.map((v) => effectiveSalePrice(v, product));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { price: min, mixed: min !== max };
}

/**
 * آیا قیمت واریانت با قیمت پایه‌ی کالا اختلاف دارد؟
 *
 * برای هشدار دادن به کاربر. اختلاف *غلط نیست* — ممکن است عمدی باشد —
 * ولی وقتی کاربر می‌گوید «قیمت اشتباه است»، دیدن این اختلاف
 * سریع‌ترین راه فهمیدن ماجراست.
 *
 * واریانت بدون قیمت (null) اختلاف حساب نمی‌شود؛ آن از پایه ارث
 * می‌برد.
 */
export function hasPriceMismatch(
  variant: PricedVariant | null | undefined,
  product: PricedProduct | null | undefined
): boolean {
  if (variant?.sale_price == null) return false;
  if (product?.base_sale_price == null) return false;
  return variant.sale_price !== product.base_sale_price;
}
