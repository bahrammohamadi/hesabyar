"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  Receipt,
  Users,
  Wallet,
  Settings,
  BarChart3,
  X,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { href: "/sales", label: "فروش", icon: Receipt },
  { href: "/products", label: "کالا و انبار", icon: Package },
  { href: "/inventory", label: "عملیات انبار", icon: Warehouse },
  { href: "/purchases", label: "خرید", icon: ShoppingCart },
  { href: "/contacts", label: "اشخاص", icon: Users },
  { href: "/finance", label: "مالی", icon: Wallet },
  { href: "/reports", label: "گزارش‌ها", icon: BarChart3 },
  { href: "/settings", label: "تنظیمات", icon: Settings },
];

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* پوشش تیره موبایل */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed lg:sticky top-0 right-0 z-40 h-screen w-64 bg-white border-l border-slate-200 flex flex-col transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <img src="/mehrjameh-logo.jpg" alt="مهرجامه" className="w-9 h-9 rounded-xl object-contain bg-white" />
            <div className="leading-tight">
              <div className="font-bold text-slate-800">مهرجامه</div>
              <div className="text-[10px] text-slate-400">سیستم مدیریت فروش</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <Icon size={19} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 text-xs text-slate-400 text-center">
          مهرجامه — نسخه ۱.۰
        </div>
      </aside>
    </>
  );
}
