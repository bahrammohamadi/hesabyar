import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { PageHero } from "../components/SiteChrome";
import { toFaDigits } from "@/lib/utils/format";
import { BRAND_NAME, BRAND_CONTACT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: `تماس با ما | ${BRAND_NAME}`,
  description: `راه‌های ارتباط با تیم ${BRAND_NAME}.`,
};

/**
 * صفحه‌ی تماس.
 *
 * ⚠️ عمداً فرم ارسال پیام ندارد.
 * فرم بدون بک‌اند یعنی پیام کاربر جایی نمی‌رود — که بدتر از نبودن فرم است.
 * وقتی endpoint ذخیره‌ی پیام (و محافظت ضد اسپم) آماده شد، اینجا اضافه می‌شود.
 */

const CHANNELS = [
  {
    icon: Phone,
    title: "تلفن پشتیبانی",
    value: toFaDigits("021-12345678"),
    note: "شنبه تا چهارشنبه، ۹ تا ۱۷",
  },
  {
    icon: Mail,
    title: "ایمیل",
    value: BRAND_CONTACT_EMAIL,
    note: "پاسخ‌گویی حداکثر تا یک روز کاری",
  },
  {
    icon: MapPin,
    title: "نشانی",
    value: "تهران، خیابان ولیعصر، برج مدیریت",
    note: "مراجعه‌ی حضوری با هماهنگی قبلی",
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="تماس با ما"
        title="در خدمت شما هستیم"
        description="برای مشاوره‌ی پیش از خرید، پشتیبانی فنی یا همکاری، از راه‌های زیر با ما در ارتباط باشید."
      />

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {CHANNELS.map((channel) => (
              <div
                key={channel.title}
                className="rounded-2xl border border-border bg-card p-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <channel.icon size={19} />
                </span>
                <h2 className="mt-3 text-sm font-black text-foreground">{channel.title}</h2>
                <p className="mt-1.5 text-sm font-bold text-primary" dir="ltr">
                  {channel.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{channel.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-12 sm:pb-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <MessageCircle size={17} className="text-primary" />
              <h2 className="text-sm font-black text-foreground">پیش از تماس بخوانید</h2>
            </div>
            <p className="mt-2 text-xs leading-7 text-muted-foreground">
              بسیاری از سوال‌های رایج در صفحه‌ی سوالات متداول پاسخ داده شده‌اند. اگر مشکل فنی دارید،
              لطفاً هنگام تماس نام کاربری و شرح دقیق مشکل را آماده داشته باشید تا سریع‌تر
              راهنمایی‌تان کنیم.
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-info/30 bg-info/[0.06] p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Clock size={17} className="text-info" />
              <h2 className="text-sm font-black text-foreground">ساعات پاسخ‌گویی</h2>
            </div>
            <ul className="mt-2 space-y-1 text-xs leading-7 text-muted-foreground">
              <li>شنبه تا چهارشنبه: {toFaDigits("۹:۰۰")} تا {toFaDigits("۱۷:۰۰")}</li>
              <li>پنجشنبه: {toFaDigits("۹:۰۰")} تا {toFaDigits("۱۳:۰۰")}</li>
              <li>جمعه و تعطیلات رسمی: تعطیل</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
