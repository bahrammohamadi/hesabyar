import type { Metadata } from "next";
import { PageHero } from "../components/SiteChrome";
import { BRAND_NAME, BRAND_CONTACT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: `حریم خصوصی | ${BRAND_NAME}`,
  description: `سیاست حفظ حریم خصوصی ${BRAND_NAME}.`,
};

/**
 * ⚠️ این متن یک چارچوب اولیه است، نه سند حقوقی تأییدشده.
 * پیش از فروش تجاری باید توسط مشاور حقوقی بازبینی شود.
 */

const SECTIONS = [
  {
    title: "چه اطلاعاتی جمع‌آوری می‌کنیم",
    items: [
      "اطلاعات حساب کاربری: نام، شماره موبایل و نام کسب‌وکار.",
      "اطلاعاتی که خودتان وارد می‌کنید: کالاها، مشتریان، فاکتورها و تراکنش‌های مالی.",
      "اطلاعات فنی: زمان ورود و نوع مرورگر، برای حفظ امنیت حساب.",
    ],
  },
  {
    title: "چگونه از اطلاعات استفاده می‌کنیم",
    items: [
      "ارائه‌ی سرویس و نمایش گزارش‌های شما.",
      "پشتیبانی فنی در صورت درخواست شما.",
      "بهبود محصول بر اساس الگوهای کلی استفاده (بدون بررسی محتوای داده‌ی شما).",
    ],
  },
  {
    title: "آنچه انجام نمی‌دهیم",
    items: [
      "اطلاعات مشتریان شما را به هیچ شخص یا شرکت ثالثی نمی‌فروشیم.",
      "از داده‌های کسب‌وکار شما برای تبلیغات استفاده نمی‌کنیم.",
      "بدون درخواست یا اجازه‌ی شما، به محتوای فاکتورها و مشتریانتان دسترسی نمی‌گیریم.",
    ],
  },
  {
    title: "امنیت اطلاعات",
    items: [
      "ارتباط شما با سامانه رمزنگاری‌شده (HTTPS) است.",
      "داده‌ی هر کسب‌وکار در سطح پایگاه‌داده از سایر کسب‌وکارها جدا شده است.",
      "دسترسی کاربران شما بر اساس نقشی است که خودتان تعیین می‌کنید.",
      "از اطلاعات پشتیبان‌گیری منظم انجام می‌شود.",
    ],
  },
  {
    title: "حقوق شما",
    items: [
      "در هر زمان می‌توانید از اطلاعات خود خروجی بگیرید.",
      "می‌توانید درخواست حذف حساب و داده‌هایتان را بدهید.",
      "می‌توانید بپرسید چه اطلاعاتی از شما نگهداری می‌شود.",
    ],
  },
  {
    title: "کوکی‌ها",
    items: [
      "برای حفظ نشست ورود شما از کوکی استفاده می‌کنیم؛ بدون آن هر بار باید دوباره وارد شوید.",
      "تنظیمات ظاهری مانند حالت شب در مرورگر خودتان ذخیره می‌شود، نه روی سرور ما.",
      "از کوکی تبلیغاتی یا ردیاب شخص ثالث استفاده نمی‌کنیم.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="حریم خصوصی"
        title="سیاست حفظ حریم خصوصی"
        description="اطلاعات کسب‌وکار و مشتریان شما دارایی شماست. اینجا شفاف توضیح می‌دهیم با آن چه می‌کنیم."
      />

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="rounded-2xl border border-warning/30 bg-warning/[0.06] p-4">
            <p className="text-xs leading-7 text-muted-foreground">
              این سند نسخه‌ی اولیه است و ممکن است به‌روزرسانی شود. در صورت تغییر مهم، به کاربران
              اطلاع داده می‌شود.
            </p>
          </div>

          <div className="mt-6 space-y-6">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h2 className="text-sm font-black text-foreground">{section.title}</h2>
                <ul className="mt-2 space-y-2">
                  {section.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-xs leading-7 text-muted-foreground"
                    >
                      <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div>
              <h2 className="text-sm font-black text-foreground">تماس درباره‌ی حریم خصوصی</h2>
              <p className="mt-2 text-xs leading-7 text-muted-foreground">
                اگر درباره‌ی نحوه‌ی نگهداری اطلاعاتتان سوالی دارید، از طریق{" "}
                <span dir="ltr" className="font-bold text-primary">
                  {BRAND_CONTACT_EMAIL}
                </span>{" "}
                با ما در تماس باشید.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
