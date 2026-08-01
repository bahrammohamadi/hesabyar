"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * ناوبری فرعی داخل صفحه (نوار تب).
 *
 * چرا هم سایدبار و هم تب؟
 *   الگوی رایج در ابزارهای امروزی: سایدبار مقصد را نشان می‌دهد و تبِ
 *   داخل صفحه جابه‌جایی بین زیربخش‌های همان مقصد را سریع می‌کند —
 *   بدون اینکه چشم کاربر از محتوا به سایدبار برود و برگردد.
 *   برای بخش‌هایی مثل «تنظیمات» که کاربر بین ۵ زیرصفحه رفت‌وبرگشت
 *   زیاد دارد، این تفاوت محسوسی می‌سازد.
 *
 * روی موبایل به‌صورت افقی اسکرول می‌شود تا فضای عمودی نگیرد.
 */

export type SubNavItem = {
  href: string;
  label: string;
  /** تعداد اختیاری کنار عنوان (مثلاً تعداد آیتم‌ها). */
  badge?: string | number;
};

export function SubNav({ items, className }: { items: SubNavItem[]; className?: string }) {
  const pathname = usePathname();

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="ناوبری بخش"
      className={cn(
        "-mx-3 mb-4 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      <div className="inline-flex min-w-full gap-1 rounded-xl border border-border bg-muted/50 p-1">
        {items.map((item) => {
          // تطبیق دقیق تا مسیر والد همه‌ی فرزندها را فعال نکند.
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-bold transition",
                active
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
              )}
            >
              {item.label}
              {item.badge !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums",
                    active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
