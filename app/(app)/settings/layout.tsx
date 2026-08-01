import type { ReactNode } from "react";
import { SubNav, type SubNavItem } from "@/src/shared/ui";

/**
 * چیدمان مشترک بخش تنظیمات.
 *
 * نوار تب بالای محتوا اضافه می‌شود تا جابه‌جایی بین زیربخش‌ها بدون
 * رفتن به سایدبار ممکن باشد. سایدبار همچنان همین زیرصفحه‌ها را نشان
 * می‌دهد؛ این دو مکمل‌اند نه جایگزین — الگوی رایج در ابزارهای امروزی.
 */

const SETTINGS_NAV: SubNavItem[] = [
  { href: "/settings", label: "داشبورد تنظیمات" },
  { href: "/settings/users", label: "کاربران و دسترسی‌ها" },
  { href: "/settings/accounts", label: "مالی و حساب‌ها" },
  { href: "/settings/catalog", label: "کاتالوگ" },
  { href: "/settings/price-lists", label: "لیست قیمت‌ها" },
  { href: "/settings/general", label: "عمومی" },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SubNav items={SETTINGS_NAV} />
      {children}
    </>
  );
}
