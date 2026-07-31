import Link from "next/link";
import { ArrowLeft, ClipboardList, LineChart, Rocket, UserPlus } from "lucide-react";
import { toFaDigits } from "@/lib/utils/format";
import { BRAND_NAME } from "@/lib/brand";

/**
 * بخش‌های میانی صفحه‌ی اصلی: «چطور شروع کنم» و «مناسب چه کسب‌وکارهایی».
 *
 * محتوا عمداً محافظه‌کارانه است — هیچ عدد یا ادعای اثبات‌نشده‌ای
 * (تعداد کاربر، درصد رشد، مدت تست رایگان) در آن نیست.
 */

const STEPS = [
  {
    icon: UserPlus,
    title: "حساب بسازید",
    body: "با شماره موبایل ثبت‌نام کنید و اطلاعات کسب‌وکارتان را وارد نمایید.",
  },
  {
    icon: ClipboardList,
    title: "کالاها را وارد کنید",
    body: "محصولات، قیمت‌ها و موجودی اولیه‌ی انبار را تعریف کنید.",
  },
  {
    icon: Rocket,
    title: "فروش را شروع کنید",
    body: "از صفحه‌ی فروش، فاکتور صادر کنید و موجودی به‌صورت خودکار به‌روز می‌شود.",
  },
  {
    icon: LineChart,
    title: "گزارش بگیرید",
    body: "سود و زیان، پرفروش‌ترین کالاها و مانده‌ی مشتریان را در گزارش‌ها ببینید.",
  },
];

const AUDIENCES = [
  { title: "پوشاک و مزون", body: "مدیریت سایز و رنگ به‌صورت تنوع کالا، همراه با پرونده‌ی مشتریان." },
  { title: "سوپرمارکت و خواربار", body: "فروش سریع با بارکدخوان و کنترل لحظه‌ای موجودی." },
  { title: "لوازم یدکی و ابزار", body: "تعداد بالای کالا با کد فنی، جستجوی سریع و نقطه‌ی سفارش." },
  { title: "لوازم خانگی و دیجیتال", body: "فروش اقساطی، ثبت چک و پیگیری مانده‌ی حساب مشتریان." },
];

export function HomeExtras() {
  return (
    <>
      {/* چطور شروع کنیم */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-xl font-black text-foreground sm:text-2xl">
              شروع کار با {BRAND_NAME} در چهار گام
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-8 text-muted-foreground">
              بدون نیاز به دانش حسابداری؛ در کمتر از یک ساعت فروشگاه شما آماده‌ی کار است.
            </p>
          </div>

          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="group rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                    <step.icon size={18} />
                  </span>
                  <span className="text-2xl font-black text-muted-foreground/25 tabular-nums">
                    {toFaDigits(index + 1)}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-black text-foreground">{step.title}</h3>
                <p className="mt-1.5 text-xs leading-7 text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-8 text-center">
            <Link
              href="/guide"
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-card px-5 text-sm font-bold text-foreground transition-all duration-200 hover:border-primary/30 hover:text-primary active:scale-95"
            >
              راهنمای کامل شروع
              <ArrowLeft size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* مناسب چه کسب‌وکارهایی */}
      <section className="border-y border-border bg-muted/40 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-xl font-black text-foreground sm:text-2xl">
              مناسب چه کسب‌وکارهایی است؟
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-8 text-muted-foreground">
              {BRAND_NAME} برای فروشگاه‌هایی طراحی شده که کالا می‌فروشند و انبار دارند.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCES.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <h3 className="text-sm font-black text-foreground">{item.title}</h3>
                <p className="mt-2 text-xs leading-7 text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
