"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { LayoutDashboard, Receipt, Package, ShoppingCart, Users } from "lucide-react";
import { usePermission } from "@/lib/hooks/usePermission";

const ITEMS = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard, permission: null },
  { href: "/purchases", label: "خرید", icon: ShoppingCart, permission: "purchases.view" },
  { href: "/sales", label: "فروش", icon: Receipt, primary: true, permission: "sales.view" },
  { href: "/products", label: "کالا", icon: Package, permission: "products.view" },
  { href: "/contacts", label: "اشخاص", icon: Users, permission: "contacts.view" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { can } = usePermission();
  const visibleItems = ITEMS.filter((item) => can(item.permission));

  return (
    <nav className="fixed inset-x-3 bottom-3 z-30 rounded-[24px] border border-white/70 bg-white/90 shadow-2xl shadow-slate-900/10 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div
        className="grid h-[68px] items-center"
        style={{ gridTemplateColumns: `repeat(${visibleItems.length || 1}, minmax(0, 1fr))` }}
      >
        {visibleItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          if (item.primary) {
            return (
              <Link key={item.href} href={item.href} className="flex min-w-0 flex-col items-center justify-center">
                <div
                  className={cn(
                    "-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-xl shadow-primary/25 transition-transform active:scale-95",
                    active ? "bg-primary" : "bg-primary/95"
                  )}
                >
                  <Icon size={25} />
                </div>
                <span className="mt-0.5 text-[10px] font-extrabold text-primary">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl transition-colors active:scale-95",
                active ? "text-primary" : "text-slate-400"
              )}
            >
              <span className={cn("rounded-xl p-1.5", active && "bg-primary/10")}><Icon size={21} /></span>
              <span className="max-w-full truncate px-1 text-[10px] font-bold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
