"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fullJalali, displayUsername } from "@/lib/utils/format";
import { LogOut, UserCircle, Bell } from "lucide-react";
import { GlobalSearchBar } from "@/src/shared/layout/GlobalSearchBar";
import { BRAND_NAME } from "@/lib/brand";

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { data: currentUser } = useQuery({
    queryKey: ["header-current-user"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      return {
        email: user?.email ?? "",
        // اگر نام تنظیم نشده باشد، از نام کاربری بدون دامنه استفاده می‌شود
        name: user?.user_metadata?.name ?? displayUsername(user?.email) ?? "کاربر",
      };
    },
    staleTime: 60_000,
  });

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
          <button className="hidden h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-primary sm:flex" aria-label="اعلان‌ها">
            <Bell size={18} />
          </button>
          <div className="hidden min-w-0 items-center gap-2 rounded-2xl border border-border bg-muted/80 px-3 py-2 text-sm text-foreground sm:flex">
            <UserCircle size={18} className="shrink-0 text-primary" />
            <div className="min-w-0 leading-tight text-right">
              <div className="max-w-36 truncate font-bold">{currentUser?.name ?? "کاربر"}</div>
              {currentUser?.email && <div className="max-w-40 truncate text-2xs text-muted-foreground" dir="ltr">{displayUsername(currentUser.email)}</div>}
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
