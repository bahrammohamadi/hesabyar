import type { ReactNode } from "react";
import { SubNav, type SubNavItem } from "@/src/shared/ui";

/**
 * چیدمان مشترک بخش تنظیمات.
 *
 * نوار تب بالای محتوا اضافه می‌شود تا جابه‌جایی بین زیربخش‌ها بدون
 * رفتن به سایدبار ممکن باشد. سایدبار همچنان همین زیرصفحه‌ها را نشان
 * می‌دهد؛ این دو مکمل‌اند نه جایگزین — الگوی رایج در ابزارهای امروزی.
 */

/*
  ترتیب عمدی: پرکاربردترین‌ها اول.

  «حساب کاربری» پیش از این در نوار نبود، در حالی که تغییر رمز عبور
  یکی از رایج‌ترین کارهاست و کاربر باید از داشبورد پیدایش می‌کرد.
*/
const SETTINGS_NAV: SubNavItem[] = [
  { href: "/settings", label: "همه" },
  { href: "/settings/account", label: "حساب کاربری" },
  { href: "/settings/users", label: "کاربران و دسترسی‌ها" },
  { href: "/settings/catalog", label: "کاتالوگ" },
  { href: "/settings/accounts", label: "مالی و حساب‌ها" },
  { href: "/settings/price-lists", label: "لیست قیمت‌ها" },
  { href: "/settings/general", label: "کسب‌وکار و ظاهر" },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SubNav items={SETTINGS_NAV} />
      {children}
    </>
  );
}
