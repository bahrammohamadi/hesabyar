"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fullJalali, displayUsername } from "@/lib/utils/format";
import { LogOut, UserCircle, Bell } from "lucide-react";
import { GlobalSearchBar } from "@/src/shared/layout/GlobalSearchBar";

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
            <div className="text-sm font-extrabold text-slate-800 lg:hidden">مهرجامه</div>
            <div className="hidden text-sm text-slate-500 sm:block">{fullJalali()}</div>
          </div>
        </div>

        <GlobalSearchBar />

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button className="hidden h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:text-primary sm:flex" aria-label="اعلان‌ها">
            <Bell size={18} />
          </button>
          <div className="hidden min-w-0 items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm text-slate-700 sm:flex">
            <UserCircle size={18} className="shrink-0 text-primary" />
            <div className="min-w-0 leading-tight text-right">
              <div className="max-w-36 truncate font-bold">{currentUser?.name ?? "کاربر"}</div>
              {currentUser?.email && <div className="max-w-40 truncate text-[11px] text-slate-400" dir="ltr">{displayUsername(currentUser.email)}</div>}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl px-2.5 text-sm text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600 sm:px-3"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </div>
    </header>
  );
}
