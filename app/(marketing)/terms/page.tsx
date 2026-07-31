import type { Metadata } from "next";
import { PageHero } from "../components/SiteChrome";
import { BRAND_NAME, BRAND_CONTACT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: `قوانین و مقررات | ${BRAND_NAME}`,
  description: `شرایط استفاده از سرویس ${BRAND_NAME}.`,
};

/**
 * ⚠️ چارچوب اولیه است، نه سند حقوقی نهایی.
 * پیش از فروش تجاری باید توسط مشاور حقوقی بازبینی شود.
 */

const SECTIONS = [
  {
    title: "پذیرش شرایط",
    body: `با ساخت حساب کاربری در ${BRAND_NAME}، استفاده‌ی شما از سرویس مشمول این شرایط می‌شود. اگر با بخشی از آن موافق نیستید، لطفاً از سرویس استفاده نکنید.`,
  },
  {
    title: "حساب کاربری",
    body: "مسئولیت حفظ رمز عبور و فعالیت‌هایی که با حساب شما انجام می‌شود بر عهده‌ی خودتان است. در صورت مشاهده‌ی دسترسی غیرمجاز، فوراً اطلاع دهید. اطلاعاتی که هنگام ثبت‌نام وارد می‌کنید باید صحیح باشد.",
  },
  {
    title: "استفاده‌ی مجاز",
    body: "سرویس برای مدیریت کسب‌وکار قانونی شماست. استفاده برای فعالیت غیرقانونی، تلاش برای نفوذ، ارسال بدافزار، یا ایجاد بار غیرعادی روی سامانه ممنوع است و منجر به تعلیق حساب می‌شود.",
  },
  {
    title: "مالکیت داده",
    body: "اطلاعاتی که وارد می‌کنید متعلق به شماست. ما فقط نگهدارنده‌ی آن هستیم و در هر زمان می‌توانید خروجی بگیرید. مالکیت خودِ نرم‌افزار و کد آن متعلق به تیم توسعه است.",
  },
  {
    title: "اشتراک و پرداخت",
    body: "پلن پایه رایگان است. پلن‌های پولی برای دوره‌ی مشخصی فعال می‌شوند. تغییر قیمت‌ها با اطلاع‌رسانی قبلی انجام می‌شود و روی دوره‌ی جاری شما اثر نمی‌گذارد.",
  },
  {
    title: "در دسترس بودن سرویس",
    body: "تلاش می‌کنیم سرویس همیشه در دسترس باشد، اما ممکن است برای به‌روزرسانی یا تعمیرات، قطعی کوتاه پیش بیاید. قطعی‌های برنامه‌ریزی‌شده از قبل اطلاع داده می‌شود.",
  },
  {
    title: "محدودیت مسئولیت",
    body: "صحت اطلاعاتی که وارد می‌کنید بر عهده‌ی شماست. توصیه می‌کنیم به‌صورت دوره‌ای از داده‌های خود خروجی تهیه کنید. مسئولیت تصمیم‌های تجاری که بر اساس گزارش‌ها می‌گیرید با خود شماست.",
  },
  {
    title: "تعلیق و لغو",
    body: "در صورت نقض این شرایط، حساب ممکن است تعلیق شود. شما نیز در هر زمان می‌توانید درخواست حذف حساب بدهید. پیش از حذف، فرصت دریافت خروجی داده‌ها به شما داده می‌شود.",
  },
  {
    title: "تغییر شرایط",
    body: "این شرایط ممکن است به‌روزرسانی شود. تغییرات مهم از طریق سایت یا پنل اطلاع‌رسانی می‌شود.",
  },
];

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="قوانین"
        title="شرایط استفاده از سرویس"
        description="لطفاً پیش از استفاده، این شرایط را مطالعه کنید."
      />

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="rounded-2xl border border-warning/30 bg-warning/[0.06] p-4">
            <p className="text-xs leading-7 text-muted-foreground">
              این سند نسخه‌ی اولیه است و ممکن است به‌روزرسانی شود.
            </p>
          </div>

          <ol className="mt-6 space-y-5">
            {SECTIONS.map((section, index) => (
              <li key={section.title} className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-black text-foreground">
                  <span className="text-primary tabular-nums">{index + 1}. </span>
                  {section.title}
                </h2>
                <p className="mt-2 text-xs leading-7 text-muted-foreground">{section.body}</p>
              </li>
            ))}
          </ol>

          <p className="mt-6 text-xs leading-7 text-muted-foreground">
            سوالی درباره‌ی این شرایط دارید؟ با{" "}
            <span dir="ltr" className="font-bold text-primary">
              {BRAND_CONTACT_EMAIL}
            </span>{" "}
            تماس بگیرید.
          </p>
        </div>
      </section>
    </>
  );
}
