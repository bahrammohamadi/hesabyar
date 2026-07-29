import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  Check,
  CloudCog,
  Diamond,
  Mail,
  MapPin,
  Package,
  Phone,
  Receipt,
  ScanBarcode,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge, Card } from "@/src/shared/ui";
import { toFaDigits } from "@/lib/utils/format";

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

const NAV = [
  { href: "#features", label: "ویژگی‌ها" },
  { href: "#pricing", label: "تعرفه‌ها" },
  { href: "#about", label: "درباره ما" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Receipt size={18} />
          </span>
          <span className="text-base font-black text-foreground">حساب‌یار</span>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="text-sm font-bold text-muted-foreground transition hover:text-primary"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex min-h-9 items-center rounded-xl px-3 text-sm font-bold text-foreground/80 transition hover:bg-muted hover:text-foreground"
          >
            ورود
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-9 items-center rounded-xl bg-primary px-3.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
          >
            ثبت‌نام رایگان
          </Link>
        </div>
      </div>
    </header>
  );
}

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
        <span className="text-primary">ساده‌تر از همیشه با حساب‌یار</span>
      </h1>

      <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-muted-foreground sm:text-base">
        حساب‌یار به شما کمک می‌کند فاکتورها را سریع صادر کنید، موجودی انبار را در لحظه چک کنید و با
        گزارش‌های دقیق سود و زیان، بهترین تصمیم‌ها را برای رشد کسب‌وکارتان بگیرید.
      </p>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/register"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-black text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:w-auto"
        >
          شروع رایگان حساب‌یار
        </Link>
        <Link
          href="/login"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 text-sm font-bold text-foreground transition hover:border-primary/30 hover:text-primary sm:w-auto"
        >
          ورود به حساب
        </Link>
      </div>

      {/* آمار — مطابق مرجع موبایل */}
      <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile value={`+${toFaDigits("10,000")}`} label="کسب‌وکار فعال" icon={Users} highlight />
        <StatTile value="امنیت بالا" label="تضمین داده‌ها" icon={ShieldCheck} />
        <StatTile value="همگام‌سازی" label="دسترسی آنی" icon={CloudCog} />
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
      className={`rounded-2xl border p-4 text-center ${
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
    title: "اسکن بارکد",
    body: "با استفاده از دوربین موبایل یا دستگاه بارکدخوان، کالاهای خود را سریع جستجو و به فاکتور اضافه کنید.",
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
          <h2 className="text-xl font-black text-foreground sm:text-2xl">چرا حساب‌یار؟</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            تمام ابزارهایی که برای مدیریت یک فروشگاه موفق نیاز دارید
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
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

type Plan = {
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

const PLANS: Plan[] = [
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
    features: [
      "محصولات نامحدود",
      "مدیریت کامل انبارداری",
      "پنل پیامکی رایگان",
      "۱۵٪ تخفیف اقتصادی",
    ],
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

export function MarketingPricing() {
  return (
    <section id="pricing" className="py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-xl font-black text-foreground sm:text-2xl">پلن‌های اشتراک حساب‌یار</h2>
          <p className="mt-2 text-sm text-muted-foreground">متناسب با نیاز و ابعاد کسب‌وکار شما</p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const featured = plan.featured;
  return (
    <div
      className={[
        "relative flex h-full flex-col rounded-[1.75rem] border p-5 shadow-sm transition",
        featured
          ? "border-primary bg-primary text-primary-foreground shadow-md"
          : "border-border bg-card hover:-translate-y-0.5 hover:shadow-md",
      ].join(" ")}
    >
      {featured && (
        <span className="absolute -top-3 right-5 inline-flex items-center gap-1 rounded-full bg-primary-foreground px-3 py-1 text-[11px] font-black text-primary shadow-sm">
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
          <span className={`text-[11px] ${featured ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {plan.unit}
          </span>
        )}
      </div>

      <p className={`mt-2 text-xs leading-6 ${featured ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
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
          "mt-5 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-black transition",
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
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[1.75rem] bg-primary p-6 text-center text-primary-foreground shadow-sm sm:p-10">
        <h2 className="text-lg font-black sm:text-2xl">همین امروز کسب‌وکارت را متحول کن</h2>
        <p className="mx-auto mt-3 max-w-xl text-xs leading-7 text-primary-foreground/75 sm:text-sm">
          ۱۴ روز تست رایگان بدون نیاز به کارت بانکی. تمام امکانات را امتحان کنید.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary-foreground px-6 text-sm font-black text-primary transition hover:bg-primary-foreground/90 sm:w-auto"
          >
            ایجاد حساب کاربری
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-primary-foreground/25 px-6 text-sm font-bold text-primary-foreground transition hover:bg-primary-foreground/10 sm:w-auto"
          >
            تماس با واحد فروش
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* پاورقی                                                              */
/* ------------------------------------------------------------------ */

const FOOTER_LINKS: { title: string; items: { label: string; href: string }[] }[] = [
  {
    title: "لینک‌های سریع",
    items: [
      { label: "داشبورد", href: "/dashboard" },
      { label: "امکانات سیستم", href: "#features" },
      { label: "پلن‌های فروش", href: "#pricing" },
    ],
  },
  {
    title: "راهنمای کاربران",
    items: [
      { label: "آموزش کار با پنل", href: "#features" },
      { label: "حریم خصوصی", href: "#about" },
      { label: "قوانین و مقررات", href: "#about" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer id="about" className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Receipt size={18} />
            </span>
            <span className="text-base font-black text-foreground">حساب‌یار</span>
          </div>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            حساب‌یار همراه هوشمند شما در مدیریت مالی و انبارداری است. ما با ساده‌سازی فرآیندهای
            پیچیده حسابداری، فرصت تمرکز روی رشد کسب‌وکارتان را فراهم می‌کنیم.
          </p>
        </div>

        {FOOTER_LINKS.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-extrabold text-foreground">{col.title}</h3>
            <ul className="mt-3 space-y-2">
              {col.items.map((it) => (
                <li key={it.label}>
                  <Link href={it.href} className="text-xs text-muted-foreground transition hover:text-primary">
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="text-sm font-extrabold text-foreground">ارتباط با ما</h3>
          <ul className="mt-3 space-y-2.5 text-xs text-muted-foreground">
            <ContactRow icon={Phone} text={toFaDigits("021-12345678")} />
            <ContactRow icon={Mail} text="info@hesabyar.ir" />
            <ContactRow icon={MapPin} text="تهران، خیابان ولیعصر، برج مدیریت" />
          </ul>
        </div>
      </div>

      <div className="border-t border-border py-4 text-center text-[11px] text-muted-foreground">
        © {toFaDigits(1403)} تمامی حقوق برای حساب‌یار محفوظ است.
      </div>
    </footer>
  );
}

function ContactRow({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <Icon size={14} className="shrink-0 text-primary" />
      <span className="tabular-nums">{text}</span>
    </li>
  );
}

/** بسته‌بندی مشترک بخش‌ها */
export function MarketingShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
