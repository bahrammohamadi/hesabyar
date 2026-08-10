import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleDashed, HelpCircle } from "lucide-react";
import { PageHero } from "../../components/SiteChrome";
import { BRAND_NAME } from "@/lib/brand";
import { INDUSTRIES, findIndustry, industryMeta } from "@/lib/industries";

/**
 * صفحه‌ی یک صنف.
 *
 * ساختار عمدی: «مشکل → پاسخ». هر پاسخ به یک مسیر واقعی پنل اشاره
 * می‌کند، و بخش «هنوز نداریم» پیش از دکمه‌ی ثبت‌نام می‌آید نه بعد از
 * آن — بهتر است کاربر قبل از ثبت‌نام بداند تا بعد ناامید شود.
 */

/** همه‌ی صنف‌ها در زمان بیلد ساخته می‌شوند؛ محتوا ثابت است. */
export function generateStaticParams() {
  return INDUSTRIES.map((industry) => ({ id: industry.id }));
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const industry = findIndustry(params.id);
  const meta = industryMeta(params.id);
  if (!industry || !meta) return { title: "صنف یافت نشد" };

  return {
    title: `${meta.label} | ${BRAND_NAME}`,
    description: industry.intro.slice(0, 155),
    openGraph: { title: industry.headline, description: industry.intro.slice(0, 155) },
  };
}

export default function IndustryPage({ params }: { params: { id: string } }) {
  const industry = findIndustry(params.id);
  const meta = industryMeta(params.id);
  if (!industry || !meta) notFound();

  return (
    <>
      <PageHero eyebrow={`${meta.emoji} ${meta.label}`} title={industry.headline} description={industry.intro} />

      {/* ── مشکل و پاسخ ── */}
      <section aria-labelledby="solutions-heading" className="py-10 sm:py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 id="solutions-heading" className="mb-6 text-base font-black text-foreground">
            چه مشکلی را حل می‌کنیم
          </h2>

          <ul className="space-y-4">
            {industry.solutions.map((solution) => (
              <li
                key={solution.pain}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex items-start gap-3">
                  <HelpCircle size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                  <p className="text-sm font-bold leading-7 text-foreground">«{solution.pain}»</p>
                </div>

                <div className="mt-3 flex items-start gap-3 border-t border-border pt-3">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs leading-7 text-muted-foreground">{solution.answer}</p>
                    {/*
                      لینک به مسیر واقعی پنل. برای بازدیدکننده‌ی
                      خارج‌شده به /login می‌رود، که رفتار درستی است:
                      می‌خواهد ببیند، پس باید وارد شود یا ثبت‌نام کند.
                    */}
                    <Link
                      href={solution.route}
                      className="mt-2 inline-flex items-center gap-1.5 text-2xs font-bold text-primary hover:underline"
                    >
                      دیدن در برنامه
                      <ArrowLeft size={12} aria-hidden />
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/*
        🔴 صداقت پیش از ثبت‌نام.
        همان قاعده‌ی صفحه‌ی امکانات: بهتر است کاربر پیش از خرید بداند
        چه چیزی نداریم، تا بعد از خرید ناامید شود.
      */}
      {industry.notYet.length > 0 && (
        <section className="pb-10 sm:pb-14">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="rounded-2xl border border-warning/30 bg-warning/[0.06] p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <CircleDashed size={17} className="text-warning" aria-hidden />
                <h2 className="text-sm font-black text-foreground">
                  آنچه برای این صنف هنوز نداریم
                </h2>
              </div>
              <ul className="mt-3 space-y-1.5">
                {industry.notYet.map((item) => (
                  <li key={item} className="text-xs leading-7 text-muted-foreground">
                    • {item}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-2xs leading-6 text-muted-foreground">
                این موارد را ننوشته‌ایم تا بعداً غافلگیر نشوید. اگر یکی از این‌ها برایتان
                حیاتی است، پیش از ثبت‌نام با ما تماس بگیرید.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── دعوت به شروع ── */}
      <section className="pb-12 text-center sm:pb-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="text-base font-black text-foreground">
            ۱۴ روز رایگان، بدون کارت بانکی
          </h2>
          <p className="mt-2 text-xs leading-7 text-muted-foreground">
            حساب بسازید و با داده‌ی خودتان امتحان کنید.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/register"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
            >
              شروع رایگان
            </Link>
            <Link
              href="/industries"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-bold text-foreground transition hover:border-primary/40"
            >
              صنف‌های دیگر
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
