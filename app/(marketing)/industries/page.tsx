import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHero } from "../components/SiteChrome";
import { BRAND_NAME } from "@/lib/brand";
import { INDUSTRIES, industryMeta } from "@/lib/industries";

export const metadata: Metadata = {
  title: `صنف شما | ${BRAND_NAME}`,
  description: `${BRAND_NAME} برای پوشاک، کافه، سوپرمارکت، موبایل، طلا و چند صنف دیگر چه مشکلی را حل می‌کند.`,
};

/**
 * فهرست صنف‌ها.
 *
 * چرا صفحه‌ی جدا و نه یک بخش در «امکانات»؟
 *   صفحه‌ی امکانات فهرست قابلیت‌هاست — کاربر باید خودش ترجمه کند که
 *   «تنوع کالا» یعنی «سایز و رنگ شومیز». این صفحه همان ترجمه را
 *   انجام می‌دهد: از زبان مشکلِ کاربر شروع می‌کند نه از زبان محصول.
 */
export default function IndustriesPage() {
  return (
    <>
      <PageHero
        eyebrow="صنف شما"
        title="کسب‌وکار شما چه مشکلی دارد؟"
        description="هر صنف دردسر خودش را دارد. صنفتان را انتخاب کنید تا دقیقاً ببینید کدام بخش برنامه به کارتان می‌آید — و چه چیزی هنوز نداریم."
      />

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INDUSTRIES.map((industry) => {
              const meta = industryMeta(industry.id);
              return (
                <li key={industry.id}>
                  <Link
                    href={`/industries/${industry.id}`}
                    className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition hover:border-primary/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <span className="text-2xl" aria-hidden>
                      {meta?.emoji}
                    </span>
                    <h2 className="mt-3 text-sm font-black text-foreground group-hover:text-primary">
                      {meta?.label}
                    </h2>
                    <p className="mt-2 flex-1 text-xs leading-7 text-muted-foreground">
                      {industry.intro.slice(0, 110)}…
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                      بیشتر بخوانید
                      <ArrowLeft size={14} aria-hidden />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/*
            صنف‌هایی که صفحه‌ی اختصاصی ندارند نباید حس «پیدا نکردم» بدهند.
          */}
          <p className="mt-8 text-center text-xs leading-7 text-muted-foreground">
            صنف شما در فهرست نیست؟{" "}
            <Link href="/features" className="font-bold text-primary hover:underline">
              فهرست کامل امکانات
            </Link>{" "}
            را ببینید — برنامه عمومی است و برای هر کسب‌وکاری که فروش، انبار و حساب دارد کار می‌کند.
          </p>
        </div>
      </section>
    </>
  );
}
