"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { usePermission } from "@/lib/hooks/usePermission";
import { NAV } from "./sidebar";

function permissionForHref(href?: string) {
  if (!href) return null;
  if (href.startsWith("/sales")) return "sales.view";
  if (href.startsWith("/purchases")) return "purchases.view";
  if (href.startsWith("/products")) return href.includes("action=new") ? "products.edit" : "products.view";
  if (href.startsWith("/inventory")) return href.includes("adjust") || href.endsWith("/in") || href.endsWith("/out") ? "inventory.adjust" : "inventory.view";
  if (href.startsWith("/contacts")) return href.includes("new-") ? "contacts.edit" : "contacts.view";
  if (href.startsWith("/crm") || href.startsWith("/loyalty")) return "contacts.view";
  if (href.startsWith("/finance")) return href === "/finance" ? "finance.view" : "finance.create";
  if (href.startsWith("/checks")) return "finance.view";
  if (href.startsWith("/reports") || href.startsWith("/activity")) return "reports.view";
  if (href.startsWith("/settings/price-lists")) return "products.edit";
  if (href.startsWith("/settings")) return "settings.manage";
  return null;
}

export function BottomNav({ onMoreClick }: { onMoreClick: () => void }) {
  const pathname = usePathname();
  const { can } = usePermission();
  const primaryItems = NAV.filter((item: any) => item.showInMobileBottomNav).map((item: any) => ({
    href: item.mobileHref ?? item.href ?? item.children?.[0]?.href ?? "#",
    label: item.label,
    icon: item.icon,
    primary: item.label === "فروش",
    permission: permissionForHref(item.mobileHref ?? item.href ?? item.children?.[0]?.href),
  })).filter((item) => can(item.permission));
  const visibleItems = [...primaryItems.slice(0, 4), { href: "#more", label: "بیشتر", icon: MoreHorizontal, permission: null, more: true }];

  return (
    <nav className="fixed inset-x-3 bottom-3 z-30 rounded-[24px] border border-white/70 bg-white/90 shadow-2xl shadow-slate-900/10 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="grid h-[68px] grid-cols-5 items-center">
        {visibleItems.map((item: any) => {
          const active = !item.more && (pathname === item.href || pathname.startsWith(item.href + "/"));
          const Icon = item.icon;
          const content = item.primary ? (
            <>
              <div className={cn("-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-xl shadow-primary/25 transition-transform active:scale-95", active ? "bg-primary" : "bg-primary/95")}><Icon size={25} /></div>
              <span className="mt-0.5 text-[10px] font-extrabold text-primary">{item.label}</span>
            </>
          ) : (
            <>
              <span className={cn("rounded-xl p-1.5", active && "bg-primary/10")}><Icon size={21} /></span>
              <span className="max-w-full truncate px-1 text-[10px] font-bold">{item.label}</span>
            </>
          );
          if (item.more) return <button key="more" onClick={onMoreClick} className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-muted-foreground transition-colors active:scale-95">{content}</button>;
          return <Link key={item.href} href={item.href} className={cn("flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl transition-colors active:scale-95", active ? "text-primary" : "text-muted-foreground")}>{content}</Link>;
        })}
      </div>
    </nav>
  );
}
