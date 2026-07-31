import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { SiteFooter, SiteHeader, SiteShell } from "./components/SiteChrome";

/**
 * چیدمان مشترک وب‌سایت عمومی.
 *
 * وضعیت ورود اینجا یک‌بار خوانده می‌شود تا هدر بداند دکمه «ورود» نشان دهد
 * یا «ورود به پنل». برخلاف نسخه‌ی قبل، کاربر واردشده به زور به داشبورد
 * منتقل نمی‌شود؛ سایت معرفی برای همه قابل مشاهده است و ورود به پنل
 * یک اقدام آگاهانه است.
 */
export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <SiteShell>
      <SiteHeader isAuthenticated={Boolean(user)} />
      {/* id هدف لینک «پرش به محتوا»؛ tabIndex={-1} تا فوکوس واقعاً منتقل شود */}
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
      <SiteFooter />
    </SiteShell>
  );
}
