import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  Check,
  CloudCog,
  Diamond,
  Package,
  Receipt,
  ScanBarcode,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge, Card } from "@/src/shared/ui";
import { toFaDigits } from "@/lib/utils/format";
import type { MarketingPlan } from "../plans";
import { BRAND_NAME, BRAND_CONTACT_EMAIL } from "@/lib/brand";

/**
 * قطعات صفحه‌ی معرفی (لندینگ) — مطابق مراجع hero_features و pricing.
 *
 * ⚠️ همه‌ی رنگ‌ها از توکن‌های معنایی پروژه می‌آیند، نه hex خام مرجع،
 * تا دارک‌مود و تعویض تم همچنان کار کند.
 *
 * این فایل عمداً کلاینت‌کامپوننت نیست تا صفحه بتواند سرور-کامپوننت بماند
 * و ریدایرکت کاربر واردشده روی سرور انجام شود.
 */

/* ------------------------------------------------------------------ */
/* هدر عمومی                                                           */
/* ------------------------------------------------------------------ */



/* ------------------------------------------------------------------ */
/* بخش قهرمان (Hero)                                                   */
/* ------------------------------------------------------------------ */

export function MarketingHero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-10 pt-12 text-center sm:px-6 sm:pb-14 sm:pt-16">
      <div className="flex justify-center">
        <Badge tone="success">
          <ShieldCheck size={13} />
          نسل جدید مدیریت مالی کسب‌وکارهای کوچک
        </Badge>
      </div>

      <h1 className="mx-auto mt-6 max-w-3xl text-2xl font-black leading-[1.7] text-foreground sm:text-4xl sm:leading-[1.6]">
        مدیریت هوشمند فروش و انبارداری،
        <br />
        <span className="text-primary">ساده‌تر از همیشه با {BRAND_NAME}</span>
      </h1>

      <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-muted-foreground sm:text-base">
        {BRAND_NAME} به شما کمک می‌کند فاکتورها را سریع صادر کنید، موجودی انبار را در لحظه چک کنید و با
        گزارش‌های دقیق سود و زیان، بهترین تصمیم‌ها را برای رشد کسب‌وکارتان بگیرید.
      </p>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/register"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-black text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md active:scale-95 sm:w-auto"
        >
          شروع رایگان {BRAND_NAME}
        </Link>
        <Link
          href="/login"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 text-sm font-bold text-foreground transition-all duration-200 hover:border-primary/30 hover:text-primary active:scale-95 sm:w-auto"
        >
          ورود به حساب
        </Link>
      </div>

      {/*
        این کارت‌ها عمداً فقط ویژگی‌های واقعی محصول را می‌گویند.
        ادعای «+۱۰٬۰۰۰ کسب‌وکار فعال» که از ماک‌آپ اولیه آمده بود حذف شد،
        چون داده‌ی پشتیبانی‌کننده‌ای ندارد.
      */}
      <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile value="کاملاً فارسی" label="تقویم شمسی و راست‌به‌چپ" icon={Users} highlight />
        <StatTile value="ایزوله‌سازی داده" label="هر کسب‌وکار جدا" icon={ShieldCheck} />
        <StatTile value="تحت وب" label="بدون نصب، همه‌جا" icon={CloudCog} />
      </div>
    </section>
  );
}

function StatTile({
  value,
  label,
  icon: Icon,
  highlight,
}: {
  value: string;
  label: string;
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        highlight ? "border-primary/20 bg-primary/[0.06]" : "border-border bg-card"
      }`}
    >
      <span
        className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl ${
          highlight ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon size={17} />
      </span>
      <div className="mt-2 text-lg font-black tabular-nums text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ویژگی‌ها                                                            */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: Receipt,
    title: "صدور سریع فاکتور",
    body: "کمتر از چند ثانیه فاکتور حرفه‌ای صادر کنید و به‌صورت چاپی یا دیجیتال برای مشتری ارسال نمایید.",
  },
  {
    icon: ScanBarcode,
    title: "اسکن با دوربین یا بارکدخوان",
    /*
      کامنت قبلی می‌گفت «اسکن با دوربین هنوز پیاده‌سازی نشده» و متن
      عمداً محافظه‌کارانه بود. ولی `components/shared/barcode-scanner.tsx`
      از آن زمان ساخته شده و کار می‌کند — متن از قابلیت واقعی عقب
      مانده بود، که برعکسِ ادعای دروغ است ولی باز هم اشتباه.
    */
    body: "دوربین گوشی‌تان بارکدخوان است. بارکدخوان فیزیکی و ورود دستی کد هم کار می‌کند.",
  },
  {
    icon: Package,
    title: "مدیریت انبار و مشتریان",
    body: "کنترل کامل روی موجودی کالاها، نقطه سفارش و پرونده الکترونیک مشتریان و تاریخچه خرید آن‌ها.",
  },
  {
    icon: BarChart3,
    title: "گزارش‌های سود و زیان",
    body: "تحلیل هوشمند عملکرد فروش، میزان سود خالص و شناسایی پرفروش‌ترین کالاها در بازه‌های زمانی مختلف.",
  },
];

export function MarketingFeatures() {
  return (
    <section id="features" className="border-y border-border bg-muted/40 py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-xl font-black text-foreground sm:text-2xl">چرا {BRAND_NAME}؟</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            تمام ابزارهایی که برای مدیریت یک فروشگاه موفق نیاز دارید
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="group p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                <Icon size={20} strokeWidth={2.2} />
              </span>
              <h3 className="mt-4 text-sm font-extrabold text-foreground">{title}</h3>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">{body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* تعرفه‌ها                                                            */
/* داده‌ها فعلاً hardcode است؛ اتصال به جدول plans در فاز بعد.          */
/* ------------------------------------------------------------------ */

/*
  پلن‌ها از جدول `plans` خوانده می‌شوند (migration 0021) و به‌صورت prop
  به این کامپوننت می‌رسند. تعریف نوع و داده‌ی پشتیبان در ./plans.ts است.
*/

export function MarketingPricing({ plans }: { plans: MarketingPlan[] }) {
  return (
    <section id="pricing" className="py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-xl font-black text-foreground sm:text-2xl">پلن‌های اشتراک {BRAND_NAME}</h2>
          <p className="mt-2 text-sm text-muted-foreground">متناسب با نیاز و ابعاد کسب‌وکار شما</p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanCard({ plan }: { plan: MarketingPlan }) {
  const featured = plan.featured;
  return (
    <div
      className={[
        "relative flex h-full flex-col rounded-2xl border p-5 shadow-sm transition",
        featured
          ? "border-primary bg-primary text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5"
          : "border-border bg-card hover:-translate-y-0.5 hover:shadow-md",
      ].join(" ")}
    >
      {featured && (
        <span className="absolute -top-3 right-5 inline-flex items-center gap-1 rounded-full bg-primary-foreground px-3 py-1 text-2xs font-black text-primary shadow-sm">
          <Diamond size={12} />
          پیشنهاد ویژه
        </span>
      )}

      <h3 className={`text-sm font-extrabold ${featured ? "text-primary-foreground" : "text-foreground"}`}>
        {plan.name}
      </h3>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={`text-2xl font-black tabular-nums ${featured ? "text-primary-foreground" : "text-foreground"}`}>
          {plan.price}
        </span>
        {plan.unit && (
          <span className={`text-2xs ${featured ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
            {plan.unit}
          </span>
        )}
      </div>

      <p className={`mt-2 text-xs leading-6 ${featured ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
        {plan.note}
      </p>

      <ul className="mt-4 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs leading-6">
            <Check
              size={15}
              className={`mt-0.5 shrink-0 ${featured ? "text-primary-foreground" : "text-success"}`}
            />
            <span className={featured ? "text-primary-foreground/90" : "text-foreground/80"}>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={plan.href}
        className={[
          "mt-5 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-black transition-all duration-200 active:scale-95",
          featured
            ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            : "border border-border bg-card text-foreground hover:border-primary/40 hover:text-primary",
        ].join(" ")}
      >
        {plan.cta}
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* فراخوان پایانی                                                      */
/* ------------------------------------------------------------------ */

export function MarketingCta() {
  return (
    <section className="px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-primary p-6 text-center text-primary-foreground shadow-sm sm:p-10">
        <h2 className="text-lg font-black sm:text-2xl">همین امروز کسب‌وکارت را متحول کن</h2>
        <p className="mx-auto mt-3 max-w-xl text-xs leading-7 text-primary-foreground/85 sm:text-sm">
          {/* پلن پایه واقعاً رایگان است (جدول plans)، پس این ادعا قابل اثبات است.
              ادعای «۱۴ روز تست رایگان» حذف شد چون منطق انقضا پیاده‌سازی نشده. */}
          با پلن رایگان شروع کنید؛ بدون نیاز به کارت بانکی. هر زمان خواستید ارتقا دهید.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary-foreground px-6 text-sm font-black text-primary transition-all duration-200 hover:bg-primary-foreground/90 active:scale-95 sm:w-auto"
          >
            ایجاد حساب کاربری
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-primary-foreground/25 px-6 text-sm font-bold text-primary-foreground transition-all duration-200 hover:bg-primary-foreground/10 active:scale-95 sm:w-auto"
          >
            تماس با واحد فروش
          </Link>
        </div>
      </div>
    </section>
  );
}
