import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  ClipboardCheck,
  CreditCard,
  FileText,
  Landmark,
  Package,
  Receipt,
  ScanBarcode,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { PageHero } from "../components/SiteChrome";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `امکانات | ${BRAND_NAME}`,
  description: `فهرست کامل امکانات ${BRAND_NAME}: صدور فاکتور، مدیریت انبار، پرونده مشتریان، گزارش سود و زیان، مدیریت چک و صندوق.`,
};

/**
 * صفحه‌ی امکانات.
 *
 * ⚠️ قاعده‌ی این صفحه: فقط قابلیت‌هایی نوشته می‌شود که واقعاً در پنل وجود
 * دارند. مواردی مثل «اسکن بارکد با دوربین موبایل»، «ورود صوتی فاکتور» و
 * «اپلیکیشن اندروید» عمداً نیامده‌اند چون پیاده‌سازی نشده‌اند.
 */

const GROUPS = [
  {
    title: "فروش و صندوق",
    icon: Receipt,
    items: [
      { title: "صدور فاکتور فروش", body: "ثبت سریع فاکتور با انتخاب مشتری، کالا و شیوه‌ی پرداخت." },
      { title: "فروش نقدی، کارتی و نسیه", body: "ترکیب چند روش پرداخت در یک فاکتور و ثبت مانده‌ی بدهی." },
      { title: "پیش‌فاکتور و سفارش", body: "ثبت سفارش مشتری و تبدیل آن به فاکتور قطعی." },
      { title: "مرجوعی فروش", body: "بازگشت کالا از مشتری با اصلاح خودکار موجودی و حساب." },
      { title: "ابطال فاکتور", body: "لغو فاکتور با ثبت دلیل و برگشت کامل اثرات انبار و مالی." },
      { title: "چاپ فاکتور", body: "خروجی چاپی مرتب برای تحویل به مشتری." },
    ],
  },
  {
    title: "کالا و انبار",
    icon: Package,
    items: [
      { title: "تعریف کالا با تنوع", body: "یک کالا با چند سایز و رنگ، هرکدام با موجودی و قیمت جدا." },
      { title: "جستجو با بارکد", body: "با بارکدخوان یا تایپ کد، کالا را فوری پیدا کنید." },
      { title: "کنترل موجودی لحظه‌ای", body: "هر فروش و خرید بلافاصله موجودی را به‌روز می‌کند." },
      { title: "نقطه‌ی سفارش", body: "هشدار خودکار وقتی موجودی کالا زیر حد نصاب برود." },
      { title: "تعدیل انبار", body: "اصلاح موجودی پس از انبارگردانی با ثبت دلیل." },
      { title: "کاردکس کالا", body: "تاریخچه‌ی کامل ورود و خروج هر کالا." },
    ],
  },
  {
    title: "خرید و تأمین‌کننده",
    icon: Boxes,
    items: [
      { title: "فاکتور خرید", body: "ثبت خرید از تأمین‌کننده و افزایش خودکار موجودی." },
      { title: "مرجوعی خرید", body: "برگشت کالا به تأمین‌کننده با اصلاح حساب." },
      { title: "پرونده‌ی تأمین‌کننده", body: "سابقه‌ی خرید و مانده‌ی حساب هر تأمین‌کننده." },
    ],
  },
  {
    title: "مشتریان",
    icon: Users,
    items: [
      { title: "پرونده‌ی الکترونیک", body: "اطلاعات تماس، آدرس و یادداشت برای هر مشتری." },
      { title: "تاریخچه‌ی خرید", body: "همه‌ی فاکتورهای هر مشتری در یک نگاه." },
      { title: "مانده‌ی حساب", body: "بدهکاری و بستانکاری هر طرف حساب به‌صورت لحظه‌ای." },
      { title: "دسته‌بندی مشتریان", body: "گروه‌بندی بر اساس معیارهای دلخواه." },
      { title: "باشگاه مشتریان", body: "امتیاز و کیف پول برای مشتریان وفادار." },
    ],
  },
  {
    title: "مالی",
    icon: Landmark,
    items: [
      { title: "صندوق و حساب بانکی", body: "تعریف چند حساب و پیگیری موجودی هرکدام." },
      { title: "دریافت و پرداخت", body: "ثبت تراکنش‌های مالی با اتصال به فاکتور." },
      { title: "مدیریت چک", body: "ثبت چک دریافتی و پرداختی با سررسید و وضعیت." },
      { title: "ثبت هزینه", body: "هزینه‌های جاری کسب‌وکار با دسته‌بندی." },
    ],
  },
  {
    title: "گزارش‌ها",
    icon: BarChart3,
    items: [
      { title: "سود و زیان", body: "سود ناخالص و خالص در بازه‌ی زمانی دلخواه." },
      { title: "گزارش فروش", body: "روند فروش روزانه، ماهانه و مقایسه‌ی دوره‌ها." },
      { title: "پرفروش‌ترین کالاها", body: "شناسایی کالاهای پرگردش و راکد." },
      { title: "سودآوری مشتریان", body: "کدام مشتری بیشترین سود را می‌سازد." },
      { title: "عملکرد فروشندگان", body: "مقایسه‌ی فروش و فعالیت کاربران." },
      { title: "خروجی اکسل", body: "دریافت گزارش‌ها به‌صورت فایل CSV." },
    ],
  },
  {
    title: "امنیت و مدیریت",
    icon: ShieldCheck,
    items: [
      { title: "کاربران چندگانه", body: "تعریف کاربر برای هر کارمند با نام کاربری جدا." },
      { title: "سطح دسترسی", body: "نقش‌های مالک، مدیر، صندوق‌دار، انباردار و حسابدار." },
      { title: "گزارش فعالیت", body: "ثبت تغییرات مهم با نام کاربر و زمان." },
      { title: "جداسازی داده", body: "اطلاعات هر کسب‌وکار کاملاً از بقیه ایزوله است." },
    ],
  },
];

const HIGHLIGHTS = [
  { icon: FileText, title: "کاملاً فارسی", body: "رابط راست‌به‌چپ با تقویم شمسی و اعداد فارسی." },
  { icon: CreditCard, title: "تحت وب", body: "بدون نصب؛ روی کامپیوتر، تبلت و موبایل کار می‌کند." },
  { icon: ClipboardCheck, title: "پشتیبان‌گیری خودکار", body: "داده‌ها روی زیرساخت ابری نگهداری می‌شوند." },
  { icon: Wallet, title: "چند شعبه", body: "امکان تعریف بیش از یک شعبه برای یک کسب‌وکار." },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="امکانات"
        title={`هر آنچه برای اداره‌ی فروشگاه لازم دارید`}
        description={`${BRAND_NAME} از ثبت فاکتور تا گزارش سود و زیان را در یک سامانه‌ی یکپارچه جمع کرده است.`}
      />

      <section aria-labelledby="highlights-heading" className="py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/*
            عنوان بصری ندارد ولی برای صفحه‌خوان لازم است:
            بدون آن، h3 کارت‌ها بلافاصله بعد از h1 می‌آمد و
            axe آن را heading-order violation گزارش می‌کرد.
          */}
          <h2 id="highlights-heading" className="sr-only">
            ویژگی‌های کلیدی
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HIGHLIGHTS.map((h) => (
              <div
                key={h.title}
                className="rounded-2xl border border-border bg-card p-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <h.icon size={19} />
                </span>
                <h3 className="mt-3 text-sm font-black text-foreground">{h.title}</h3>
                <p className="mt-1.5 text-xs leading-7 text-muted-foreground">{h.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-12 sm:pb-16">
        <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6">
          {GROUPS.map((group) => (
            <div key={group.title} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <group.icon size={18} />
                </span>
                <h2 className="text-base font-black text-foreground">{group.title}</h2>
              </div>

              <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => (
                  <div key={item.title}>
                    <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                    <p className="mt-1 text-xs leading-7 text-muted-foreground">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/*
        شفافیت درباره‌ی آنچه هنوز نداریم.
        این بخش عمدی است: بهتر است کاربر پیش از خرید بداند، تا بعد از خرید ناامید شود.
      */}
      <section className="pb-12 sm:pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-2xl border border-warning/30 bg-warning/[0.06] p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <ScanBarcode size={17} className="text-warning" />
              <h2 className="text-sm font-black text-foreground">در حال توسعه</h2>
            </div>
            <p className="mt-2 text-xs leading-7 text-muted-foreground">
              این قابلیت‌ها هنوز آماده نیستند و روی آن‌ها کار می‌کنیم: اسکن بارکد با دوربین موبایل،
              اپلیکیشن اندروید، اتصال به سامانه‌ی مودیان و درگاه پرداخت آنلاین. اسکن بارکد در حال
              حاضر با دستگاه بارکدخوان انجام می‌شود.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-12 text-center sm:pb-16">
        <Link
          href="/register"
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-6 text-sm font-black text-primary-foreground transition-all duration-200 hover:bg-primary/90 active:scale-95"
        >
          رایگان امتحان کنید
          <ArrowLeft size={16} />
        </Link>
      </section>
    </>
  );
}
