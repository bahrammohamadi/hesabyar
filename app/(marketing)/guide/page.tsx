import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lightbulb } from "lucide-react";
import { PageHero } from "../components/SiteChrome";
import { toFaDigits } from "@/lib/utils/format";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `راهنمای شروع | ${BRAND_NAME}`,
  description: `راهنمای گام‌به‌گام راه‌اندازی ${BRAND_NAME} برای فروشگاه شما.`,
};

const STEPS = [
  {
    title: "ثبت‌نام و ساخت کسب‌وکار",
    body: "با شماره موبایل ثبت‌نام کنید. سپس نام کسب‌وکار و اطلاعات پایه را وارد کنید. پس از تأیید حساب، پنل شما فعال می‌شود.",
    tips: ["نام کسب‌وکار روی فاکتورهای چاپی نمایش داده می‌شود.", "شماره موبایل، نام کاربری ورود شماست."],
  },
  {
    title: "تعریف حساب‌های مالی",
    body: "از بخش «مالی»، صندوق فروشگاه و حساب‌های بانکی خود را تعریف کنید تا بتوانید دریافت و پرداخت‌ها را به آن‌ها نسبت دهید.",
    tips: ["حداقل یک صندوق نقدی تعریف کنید.", "موجودی اولیه‌ی هر حساب را وارد کنید."],
  },
  {
    title: "ورود کالاها",
    body: "از بخش «کالا و انبار» محصولات را ثبت کنید. برای کالاهایی که سایز یا رنگ دارند، از قابلیت تنوع استفاده کنید.",
    tips: [
      "قیمت خرید را حتماً وارد کنید تا گزارش سود درست محاسبه شود.",
      "نقطه‌ی سفارش را تعیین کنید تا هشدار کمبود بگیرید.",
      "برای ورود انبوه، فایل اکسل را با کمک پشتیبانی وارد کنید.",
    ],
  },
  {
    title: "ثبت موجودی اولیه",
    body: "پیش از شروع فروش، موجودی فعلی انبار را وارد کنید تا گزارش‌ها از ابتدا دقیق باشند.",
    tips: ["پس از شمارش فیزیکی کالاها، از «انبارگردانی» استفاده کنید."],
  },
  {
    title: "تعریف مشتریان",
    body: "مشتریان دائمی را در بخش «اشخاص» ثبت کنید. برای فروش نقدی به مشتری گذری، نیازی به ثبت نیست.",
    tips: ["مانده‌ی بدهی قبلی مشتریان را به‌عنوان موجودی اولیه وارد کنید."],
  },
  {
    title: "صدور اولین فاکتور",
    body: "از بخش «فروش» فاکتور جدید بزنید: مشتری را انتخاب کنید، کالاها را اضافه کنید و شیوه‌ی پرداخت را مشخص نمایید.",
    tips: [
      "با کلید F2 در هر صفحه‌ای می‌توانید فروش جدید باز کنید.",
      "می‌توانید پرداخت را بین نقد، کارت و نسیه تقسیم کنید.",
    ],
  },
  {
    title: "تعریف کاربران",
    body: "اگر کارمند دارید، برای هرکدام کاربر جدا بسازید و سطح دسترسی مناسب بدهید.",
    tips: ["صندوق‌دار فقط به فروش دسترسی دارد.", "گزارش فعالیت نشان می‌دهد هر تغییر را چه کسی انجام داده."],
  },
  {
    title: "بررسی گزارش‌ها",
    body: "پس از چند روز کار، از بخش «گزارش‌ها» سود و زیان، پرفروش‌ترین کالاها و مانده‌ی مشتریان را بررسی کنید.",
    tips: ["گزارش‌ها را می‌توانید به اکسل خروجی بگیرید."],
  },
];

export default function GuidePage() {
  return (
    <>
      <PageHero
        eyebrow="راهنما"
        title="راه‌اندازی گام‌به‌گام"
        description={`این راهنما شما را از ثبت‌نام تا صدور اولین فاکتور و گرفتن گزارش همراهی می‌کند.`}
      />

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <ol className="space-y-4">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/25 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground tabular-nums">
                    {toFaDigits(index + 1)}
                  </span>
                  <div className="flex-1">
                    <h2 className="text-sm font-black text-foreground">{step.title}</h2>
                    <p className="mt-1.5 text-xs leading-7 text-muted-foreground">{step.body}</p>

                    {step.tips.length > 0 ? (
                      <ul className="mt-3 space-y-1.5 rounded-xl bg-muted/60 p-3">
                        {step.tips.map((tip) => (
                          <li key={tip} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <Lightbulb size={13} className="mt-1 shrink-0 text-warning" />
                            <span className="leading-6">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-8 rounded-2xl border border-border bg-muted/40 p-5 text-center">
            <p className="text-sm font-bold text-foreground">آماده‌اید شروع کنید؟</p>
            <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground transition-all duration-200 hover:bg-primary/90 active:scale-95"
              >
                ساخت حساب رایگان
                <ArrowLeft size={15} />
              </Link>
              <Link
                href="/faq"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-bold text-foreground transition-all duration-200 hover:border-primary/30 hover:text-primary active:scale-95"
              >
                سوالات متداول
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
