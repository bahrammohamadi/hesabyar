"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fullJalali } from "@/lib/utils/format";
import { LogOut, UserCircle, Menu } from "lucide-react";

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
        name: user?.user_metadata?.name ?? user?.email ?? "کاربر",
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
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={onMenuClick} 
            className="sm:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
            aria-label="Open Menu"
          >
            <Menu size={22} />
          </button>
          <div className="text-sm text-slate-500 hidden sm:block">
            {fullJalali()}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-sm text-slate-700">
            <UserCircle size={18} className="text-brand-600" />
            <div className="leading-tight text-right">
              <div className="font-medium max-w-36 truncate">{currentUser?.name ?? "کاربر"}</div>
              {currentUser?.email && <div className="text-[11px] text-slate-400 max-w-40 truncate" dir="ltr">{currentUser.email}</div>}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-rose-600 transition-colors"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </div>
    </header>
  );
}
