import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubNav, type SubNavItem } from "@/src/shared/ui";

/** زیربخش‌های پنل مدیریت پلتفرم. */
const ADMIN_NAV: SubNavItem[] = [
  { href: "/admin/organizations", label: "کسب‌وکارها" },
  { href: "/admin/audit", label: "گزارش فعالیت" },
];

/**
 * گارد سمت سرور برای کل بخش /admin.
 *
 * پیش از این، هر کاربر واردشده‌ای می‌توانست /admin/organizations را باز
 * کند: صفحه با تمام هدر و فیلترها رندر می‌شد و فقط بعد از پاسخ ۴۰۳ از
 * API یک کلمه‌ی «Forbidden» نشان می‌داد. داده‌ای لو نمی‌رفت (API درست
 * محافظت شده بود) اما وجود پنل و ساختارش برای همه آشکار بود.
 *
 * notFound به‌جای redirect: به کاربر غیرمجاز نمی‌گوییم «اینجا چیزی هست
 * که تو اجازه‌اش را نداری». صفحه‌ی ۴۰۴ استاندارد می‌بیند.
 *
 * ⚠️ این لایه‌ی *چهارم* دفاع است، نه تنها لایه. سه لایه‌ی دیگر سرِ جای
 *    خودشان می‌مانند:
 *      ۱. requirePlatformAdmin در روت API
 *      ۲. RPCهای approve/reject که خودشان is_platform_admin را چک می‌کنند
 *      ۳. RLS روی جدول‌ها
 *    حذف هرکدام به‌تنهایی نباید در را باز کند.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: isAdmin, error } = await supabase.rpc("is_platform_admin");

  // خطای RPC (مثلاً migration اجرا نشده) هم یعنی «مجاز نیست» — fail closed.
  if (error || !isAdmin) notFound();

  return (
    <>
      <SubNav items={ADMIN_NAV} />
      {children}
    </>
  );
}
