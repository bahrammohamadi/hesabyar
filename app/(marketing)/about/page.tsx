import type { Metadata } from "next";
import Link from "next/link";
import { Compass, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import { PageHero } from "../components/SiteChrome";
import { BRAND_NAME, BRAND_NAME_EN } from "@/lib/brand";

export const metadata: Metadata = {
  title: `درباره ما | ${BRAND_NAME}`,
  description: `${BRAND_NAME} چیست و برای چه کسانی ساخته شده است.`,
};

const VALUES = [
  {
    icon: Compass,
    title: "سادگی",
    body: "نرم‌افزار حسابداری نباید کلاس آموزشی بخواهد. هر صفحه طوری طراحی شده که بدون آموزش قابل استفاده باشد.",
  },
  {
    icon: ShieldCheck,
    title: "امانت‌داری در داده",
    body: "اطلاعات مشتریان و فروش شما دارایی شماست. داده‌ی هر کسب‌وکار کاملاً از بقیه جدا نگهداری می‌شود.",
  },
  {
    icon: HeartHandshake,
    title: "صداقت",
    body: "قابلیتی را که نداریم تبلیغ نمی‌کنیم. در صفحه‌ی امکانات، فهرست کارهای در حال توسعه را هم منتشر کرده‌ایم.",
  },
  {
    icon: Sparkles,
    title: "بهبود مداوم",
    body: "محصول بر اساس بازخورد واقعی فروشندگان توسعه پیدا می‌کند، نه حدس و گمان.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="درباره ما"
        title={`${BRAND_NAME} چیست؟`}
        description={`${BRAND_NAME} یک سامانه‌ی تحت وب برای مدیریت فروش، انبار و امور مالی کسب‌وکارهای کوچک و متوسط ایرانی است.`}
      />

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="space-y-4 text-sm leading-8 text-muted-foreground">
            <p>
              بیشتر فروشگاه‌های کوچک ایرانی یا هنوز با دفتر و کاغذ کار می‌کنند، یا نرم‌افزاری دارند
              که سال‌ها پیش نوشته شده و کار با آن نیازمند آموزش طولانی است. نتیجه این است که صاحب
              کسب‌وکار نمی‌داند دقیقاً چقدر سود کرده، کدام کالا راکد مانده و چه کسی چقدر بدهکار است.
            </p>
            <p>
              <strong className="text-foreground">{BRAND_NAME}</strong> برای حل همین مسئله ساخته شد:
              ابزاری که فروشنده بتواند همان روز اول با آن فاکتور بزند، بدون اینکه لازم باشد حسابداری
              بلد باشد. نام «{BRAND_NAME}» ({BRAND_NAME_EN}) از ابزار سنجش و تعادل گرفته شده — چون
              کار اصلی این نرم‌افزار، تراز نگه‌داشتن حساب‌های کسب‌وکار شماست.
            </p>
            <p>
              همه‌چیز تحت وب است؛ نیازی به نصب ندارید و از هر دستگاهی — کامپیوتر فروشگاه، تبلت یا
              موبایل — به اطلاعاتتان دسترسی دارید.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/40 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-xl font-black text-foreground sm:text-2xl">
            چه چیزی برای ما مهم است
          </h2>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {VALUES.map((value) => (
              <div
                key={value.title}
                className="rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <value.icon size={18} />
                </span>
                <h3 className="mt-3 text-sm font-black text-foreground">{value.title}</h3>
                <p className="mt-1.5 text-xs leading-7 text-muted-foreground">{value.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 text-center sm:py-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="text-lg font-black text-foreground sm:text-xl">
            سوالی دارید یا پیشنهادی برای بهتر شدن؟
          </h2>
          <p className="mt-3 text-sm leading-8 text-muted-foreground">
            خوشحال می‌شویم بشنویم. بازخورد کاربران مهم‌ترین منبع تصمیم‌گیری ما درباره‌ی محصول است.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-flex min-h-12 items-center rounded-2xl bg-primary px-6 text-sm font-black text-primary-foreground transition-all duration-200 hover:bg-primary/90 active:scale-95"
          >
            تماس با ما
          </Link>
        </div>
      </section>
    </>
  );
}
