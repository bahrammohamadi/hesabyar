import type { Metadata } from "next";
import Link from "next/link";
import { Check, Diamond, HelpCircle } from "lucide-react";
import { PageHero } from "../components/SiteChrome";
import { getMarketingPlans } from "../plans";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `تعرفه‌ها | ${BRAND_NAME}`,
  description: `پلن‌های اشتراک ${BRAND_NAME}؛ از پلن رایگان تا راه‌کار سازمانی.`,
};

/**
 * صفحه‌ی تعرفه‌ها.
 *
 * قیمت‌ها از جدول `plans` در دیتابیس خوانده می‌شوند (همان منبع صفحه‌ی اصلی)،
 * پس تغییر قیمت در دیتابیس بلافاصله اینجا هم اعمال می‌شود.
 */

const FAQ = [
  {
    q: "آیا پلن رایگان محدودیت زمانی دارد؟",
    a: "خیر. پلن پایه رایگان است و محدودیت زمانی ندارد؛ فقط سقف تعداد فاکتور ماهانه دارد.",
  },
  {
    q: "پرداخت چگونه انجام می‌شود؟",
    a: "در حال حاضر پرداخت به‌صورت دستی و با هماهنگی پشتیبانی انجام می‌شود. درگاه پرداخت آنلاین در حال راه‌اندازی است.",
  },
  {
    q: "اگر پلن را ارتقا دهم، اطلاعاتم منتقل می‌شود؟",
    a: "بله. ارتقای پلن هیچ تأثیری روی داده‌های شما ندارد و همه‌چیز دست‌نخورده باقی می‌ماند.",
  },
  {
    q: "امکان بازگشت وجه هست؟",
    a: "برای بررسی موارد خاص با پشتیبانی تماس بگیرید تا راهنمایی شوید.",
  },
];

export default async function PricingPage() {
  const plans = await getMarketingPlans();

  return (
    <>
      <PageHero
        eyebrow="تعرفه‌ها"
        title="پلنی متناسب با اندازه‌ی کسب‌وکار شما"
        description="با پلن رایگان شروع کنید و هر زمان نیاز داشتید ارتقا دهید. بدون قرارداد بلندمدت."
      />

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                  plan.featured
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card"
                }`}
              >
                {plan.featured ? (
                  <span className="absolute -top-3 right-1/2 inline-flex translate-x-1/2 items-center gap-1 rounded-full bg-warning px-3 py-1 text-2xs font-black text-warning-foreground">
                    <Diamond size={12} />
                    پیشنهاد ویژه
                  </span>
                ) : null}

                <h2
                  className={`text-sm font-black ${
                    plan.featured ? "text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {plan.name}
                </h2>

                <div className="mt-3 flex items-end gap-1.5">
                  <span
                    className={`text-xl font-black tabular-nums ${
                      plan.featured ? "text-primary-foreground" : "text-foreground"
                    }`}
                  >
                    {plan.price}
                  </span>
                  {plan.unit ? (
                    <span
                      className={`pb-0.5 text-2xs ${
                        plan.featured ? "text-primary-foreground/85" : "text-muted-foreground"
                      }`}
                    >
                      {plan.unit}
                    </span>
                  ) : null}
                </div>

                <p
                  className={`mt-2 text-xs leading-7 ${
                    plan.featured ? "text-primary-foreground/85" : "text-muted-foreground"
                  }`}
                >
                  {plan.note}
                </p>

                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs">
                      <Check
                        size={14}
                        className={`mt-0.5 shrink-0 ${
                          plan.featured ? "text-primary-foreground" : "text-success"
                        }`}
                      />
                      <span
                        className={
                          plan.featured ? "text-primary-foreground/90" : "text-muted-foreground"
                        }
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.id === "enterprise" ? "/contact" : plan.href}
                  className={`mt-5 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-black transition-all duration-200 active:scale-95 ${
                    plan.featured
                      ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                      : "border border-border bg-card text-foreground hover:border-primary/30 hover:text-primary"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            قیمت‌ها به تومان و بدون احتساب مالیات بر ارزش افزوده است.
          </p>
        </div>
      </section>

      <section className="border-t border-border bg-muted/30 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-xl font-black text-foreground sm:text-2xl">
            سوالات رایج درباره‌ی تعرفه‌ها
          </h2>

          <div className="mt-6 space-y-3">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start gap-2">
                  <HelpCircle size={16} className="mt-0.5 shrink-0 text-primary" />
                  <div>
                    <h3 className="text-sm font-black text-foreground">{item.q}</h3>
                    <p className="mt-1.5 text-xs leading-7 text-muted-foreground">{item.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">سوال دیگری دارید؟</p>
            <Link
              href="/contact"
              className="mt-3 inline-flex min-h-11 items-center rounded-2xl border border-border bg-card px-5 text-sm font-bold text-foreground transition-all duration-200 hover:border-primary/30 hover:text-primary active:scale-95"
            >
              تماس با ما
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
