import { createClient } from "@/lib/supabase/server";
import { toFaDigits } from "@/lib/utils/format";

/**
 * واکشی پلن‌ها برای صفحه‌ی معرفی.
 *
 * روی سرور اجرا می‌شود و از جدول `plans` (migration 0021) می‌خواند.
 * جدول policy عمومی خواندن دارد، پس بازدیدکننده‌ی مهمان هم می‌بیند.
 *
 * ⚠️ اگر جدول در دسترس نباشد (مثلاً migration روی محیطی اجرا نشده)،
 * به داده‌ی ثابت برمی‌گردیم تا لندینگ هرگز خالی یا خراب نشود.
 */

export type MarketingPlan = {
  id: string;
  name: string;
  price: string;
  unit: string;
  note: string;
  features: string[];
  featured?: boolean;
  cta: string;
  href: string;
};

type PlanRow = {
  code: string;
  name: string;
  price_rial: number;
  period_days: number | null;
  description: string | null;
  features: unknown;
  is_featured: boolean;
  sort_order: number;
};

/** متن دکمه بر اساس نوع پلن */
function ctaFor(code: string) {
  if (code === "free") return { cta: "انتخاب پلن", href: "/register" };
  if (code === "enterprise") return { cta: "تماس با واحد فروش", href: "/login" };
  if (code === "biannual") return { cta: "خرید اشتراک", href: "/register" };
  return { cta: "شروع کنید", href: "/register" };
}

/** واحد قیمت بر اساس دوره */
function unitFor(row: PlanRow) {
  if (row.price_rial <= 0) return "";
  if (row.period_days === 30) return "تومان / ماه";
  if (row.period_days) return "تومان / دوره";
  return "تومان";
}

/** قیمت نمایشی: ریال ذخیره‌شده → تومان فارسی */
function priceFor(row: PlanRow) {
  if (row.price_rial > 0) {
    // مبالغ در دیتابیس ریال هستند؛ نمایش به تومان است.
    return toFaDigits(Math.round(row.price_rial / 10).toLocaleString("en-US"));
  }
  return row.code === "enterprise" ? "تماس بگیرید" : "رایگان";
}

/** داده‌ی پشتیبان — فقط وقتی خواندن از دیتابیس شکست بخورد */
export const FALLBACK_PLANS: MarketingPlan[] = [
  {
    id: "free",
    name: "پایه",
    price: "رایگان",
    unit: "",
    note: "مناسب برای فریلنسرها و کسب‌وکارهای کوچک.",
    features: ["۱۰۰ فاکتور ماهانه", "پشتیبانی معمولی", "گزارش‌های پایه فروش"],
    cta: "انتخاب پلن",
    href: "/register",
  },
  {
    id: "monthly",
    name: "یک ماهه",
    price: toFaDigits("149,000"),
    unit: "تومان / ماه",
    note: "شروع حرفه‌ای برای فروشگاه‌های کوچک.",
    features: ["صدور فاکتور نامحدود", "مدیریت ۱۰۰ محصول", "گزارش‌های پایه فروش"],
    cta: "شروع کنید",
    href: "/register",
  },
  {
    id: "biannual",
    name: "شش ماهه",
    price: toFaDigits("749,000"),
    unit: "تومان / دوره",
    note: "بهترین گزینه برای شرکت‌های در حال رشد.",
    features: ["محصولات نامحدود", "مدیریت کامل انبارداری", "پنل پیامکی رایگان", "۱۵٪ تخفیف اقتصادی"],
    featured: true,
    cta: "خرید اشتراک",
    href: "/register",
  },
  {
    id: "enterprise",
    name: "سازمانی",
    price: "تماس بگیرید",
    unit: "",
    note: "راه‌کار اختصاصی برای هولدینگ‌ها.",
    features: ["نصب روی سرور اختصاصی", "پشتیبانی VIP", "ماژول وفاداری مشتریان"],
    cta: "تماس با واحد فروش",
    href: "/login",
  },
];

export async function getMarketingPlans(): Promise<MarketingPlan[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("plans")
      .select("code, name, price_rial, period_days, description, features, is_featured, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error || !data || data.length === 0) return FALLBACK_PLANS;

    return (data as PlanRow[]).map((row) => {
      const { cta, href } = ctaFor(row.code);
      return {
        id: row.code,
        name: row.name,
        price: priceFor(row),
        unit: unitFor(row),
        note: row.description ?? "",
        features: Array.isArray(row.features) ? (row.features as string[]) : [],
        featured: row.is_featured,
        cta,
        href,
      };
    });
  } catch {
    return FALLBACK_PLANS;
  }
}
