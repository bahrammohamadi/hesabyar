"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { LayoutDashboard, Receipt, Package, Wallet, Users } from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { href: "/products", label: "کالا", icon: Package },
  { href: "/sales", label: "فروش", icon: Receipt, primary: true },
  { href: "/finance", label: "مالی", icon: Wallet },
  { href: "/contacts", label: "اشخاص", icon: Users },
];

/** ناوبری پایین مخصوص موبایل (Bottom Navigation) */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-16">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          if (item.primary) {
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center">
                <div
                  className={cn(
                    "w-12 h-12 -mt-5 rounded-2xl flex items-center justify-center shadow-lg transition-colors",
                    active ? "bg-brand-700 text-white" : "bg-brand-600 text-white"
                  )}
                >
                  <Icon size={24} />
                </div>
                <span className="text-[10px] mt-0.5 text-brand-700 font-medium">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 transition-colors",
                active ? "text-brand-600" : "text-slate-400"
              )}
            >
              <Icon size={21} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
