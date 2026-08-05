"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fullJalali, displayUsername } from "@/lib/utils/format";
import { LogOut, UserCircle } from "lucide-react";
import { GlobalSearchBar } from "@/src/shared/layout/GlobalSearchBar";
import { useOrg } from "@/lib/hooks/useOrg";
import { BRAND_NAME } from "@/lib/brand";
import { NotificationBell } from "./notification-bell";

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { orgName } = useOrg();

  const { data: currentUser } = useQuery({
    queryKey: ["header-current-user"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      /*
        نام کامل کاربر در دو جای متفاوت ذخیره شده — بررسی روی داده‌ی
        واقعی نشان داد:

          user_metadata.name          → کاربرانی که مدیر ساخته (خانم زمانی)
          organizations.owner_full_name → ثبت‌نام‌های جدید از /onboarding (یزدانی)

        هیچ کاربری هر دو را ندارد، و حساب‌های قدیمی هیچ‌کدام را. پس هر
        دو خوانده می‌شوند و اگر هیچ‌کدام نبود، نام کاربری نمایش داده
        می‌شود.
      */
      const metaName = (user?.user_metadata?.name as string | undefined)?.trim() || null;

      /*
        🔴 باگ واقعی که در تست دیده شد: کوئری قبلی
        `.select("owner_full_name").limit(1)` بدون فیلتر سازمان بود.
        RLS چند سازمان را برمی‌گرداند (کاربر سوپرادمین است) و «اولین»
        ردیف لزوماً سازمان خود کاربر نیست.

        نتیجه: با حساب bahram وارد می‌شدیم و هدر نام «یزدانی» — مالک
        یک کسب‌وکار کاملاً دیگر — را نشان می‌داد. یعنی نشت نام بین
        سازمان‌ها.

        حالا نام از عضویت خودِ کاربر گرفته می‌شود و فقط وقتی پذیرفته
        می‌شود که او واقعاً مالک همان سازمان باشد.
      */
      let ownerName: string | null = null;
      if (!metaName && user?.id) {
        const { data: org } = await supabase
          .from("organizations")
          .select("owner_full_name, owner_id")
          .eq("owner_id", user.id)
          .limit(1)
          .maybeSingle();
        ownerName = ((org as { owner_full_name?: string | null } | null)?.owner_full_name ?? "").trim() || null;
      }

      return {
        email: user?.email ?? "",
        fullName: metaName ?? ownerName,
      };
    },
    staleTime: 60_000,
  });

  /* نام نمایشی: نام واقعی، وگرنه نام کاربری بدون دامنه. */
  const displayName =
    currentUser?.fullName ?? displayUsername(currentUser?.email) ?? "کاربر";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 border-b border-white/70 bg-white/85 shadow-sm shadow-slate-900/[0.03] backdrop-blur-xl" style={{ zIndex: "var(--z-header)" }}>
      <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-foreground lg:hidden">{BRAND_NAME}</div>
            <div className="hidden text-sm text-muted-foreground sm:block">{fullJalali()}</div>
          </div>
        </div>

        <GlobalSearchBar />

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/*
            🔴 این دکمه قبلاً کاملاً تزئینی بود — بدون onClick. کاربر
            می‌زد و هیچ اتفاقی نمی‌افتاد. حالا یادداشت‌های انتشار و
            اعلان‌های سراسری را نشان می‌دهد.
          */}
          <NotificationBell />
          {/*
            بالا نام شخص، پایین نام کسب‌وکار.

            قبلاً هر دو خط «هویت فنی» بودند: نام کاربری و همان نام
            کاربری بدون دامنه — عملاً یک اطلاعات تکراری. حالا خط دوم
            چیزی می‌گوید که کاربر واقعاً لازم دارد بداند، مخصوصاً وقتی
            چند کسب‌وکار دارد.
          */}
          <div className="hidden min-w-0 items-center gap-2 rounded-2xl border border-border bg-muted/80 px-3 py-2 text-sm text-foreground sm:flex">
            <UserCircle size={18} className="shrink-0 text-primary" />
            <div className="min-w-0 leading-tight text-right">
              <div className="max-w-36 truncate font-bold">{displayName}</div>
              {orgName && (
                <div className="max-w-40 truncate text-2xs text-muted-foreground">{orgName}</div>
              )}
            </div>
          </div>
          {/*
            aria-label لازم است چون برچسب متنی زیر بریک‌پوینت sm
            پنهان می‌شود و دکمه فقط یک آیکون می‌ماند — برای صفحه‌خوان
            بی‌نام. (ایراد critical در axe-core، از قبل روی سایت زنده.)
          */}
          <button
            onClick={handleLogout}
            aria-label="خروج از حساب"
            className="flex h-11 items-center justify-center gap-2 rounded-2xl px-2.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive sm:px-3"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </div>
    </header>
  );
}
