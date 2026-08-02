/**
 * فهرست اصناف — تک‌منبع حقیقت.
 *
 * در فرم معارفه، پنل ادمین و (بعداً) محتوای اختصاصی صفحه‌ی معرفی
 * استفاده می‌شود.
 *
 * `id` در دیتابیس ذخیره می‌شود، پس هرگز تغییرش ندهید؛ فقط `label`
 * قابل ویرایش است. افزودن مورد جدید بی‌خطر است.
 */

export type BusinessType = {
  id: string;
  label: string;
  /** ایموجی برای انتخابگر بصری — سریع‌تر از خواندن متن اسکن می‌شود. */
  emoji: string;
};

export const BUSINESS_TYPES: BusinessType[] = [
  { id: "apparel", label: "پوشاک", emoji: "👕" },
  { id: "cafe", label: "کافه و رستوران", emoji: "☕" },
  { id: "grocery", label: "سوپرمارکت و خواربار", emoji: "🛒" },
  { id: "pharmacy", label: "داروخانه و آرایشی بهداشتی", emoji: "💊" },
  { id: "mobile", label: "موبایل و لوازم جانبی", emoji: "📱" },
  { id: "jewelry", label: "طلا و جواهر", emoji: "💍" },
  { id: "bakery", label: "قنادی و نانوایی", emoji: "🍰" },
  { id: "hardware", label: "ابزار و لوازم خانگی", emoji: "🔧" },
  { id: "stationery", label: "کتاب و لوازم‌التحریر", emoji: "📚" },
  { id: "other", label: "سایر", emoji: "🏪" },
];

/** برچسب فارسی یک صنف؛ برای شناسه‌ی ناشناخته خودِ شناسه برمی‌گردد. */
export function businessTypeLabel(id: string | null | undefined): string {
  if (!id) return "—";
  return BUSINESS_TYPES.find((t) => t.id === id)?.label ?? id;
}

export const isBusinessType = (id: unknown): id is string =>
  typeof id === "string" && BUSINESS_TYPES.some((t) => t.id === id);
