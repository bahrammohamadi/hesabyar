"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fullJalali } from "@/lib/utils/format";
import { Menu, LogOut } from "lucide-react";

export function Header({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();

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
            onClick={onMenu}
            className="lg:hidden text-slate-600 p-1"
            aria-label="منو"
          >
            <Menu size={22} />
          </button>
          <div className="text-sm text-slate-500 hidden sm:block">
            {fullJalali()}
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
    </header>
  );
}
