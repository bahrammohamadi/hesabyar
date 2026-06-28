"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart, Receipt, Users,
  Wallet, Settings, BarChart3, X, ChevronDown,
  PackageSearch, Plus as PlusIcon, Layers, ArrowDownToLine,
  ArrowUpFromLine, ArrowLeftRight, ClipboardList, UserPlus, Truck,
  ArrowDownCircle, ArrowUpCircle, Scale, Landmark, ReceiptText,
  TrendingUp, ShoppingBag, BarChart2,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { href: "/sales", label: "فروش", icon: Receipt },
  {
    label: "کالا و انبار",
    icon: Package,
    children: [
      { href: "/products", label: "لیست کالاها", icon: PackageSearch },
      { href: "/products/new", label: "افزودن کالای جدید", icon: PlusIcon },
      { href: "/settings", label: "دسته‌بندی و برند", icon: Layers },
      { href: "/inventory", label: "ورود کالا", icon: ArrowDownToLine },
      { href: "/inventory", label: "خروج کالا", icon: ArrowUpFromLine },
      { href: "/inventory", label: "تعدیل موجودی", icon: ArrowLeftRight },
      { href: "/inventory", label: "گردش انبار", icon: ClipboardList },
    ],
  },
  {
    label: "اشخاص",
    icon: Users,
    children: [
      { href: "/contacts?type=customer", label: "مشتریان", icon: ShoppingBag },
      { href: "/contacts/new?type=customer", label: "مشتری جدید", icon: UserPlus },
      { href: "/contacts?type=supplier", label: "تامین‌کنندگان", icon: Truck },
      { href: "/contacts/new?type=supplier", label: "تامین‌کننده جدید", icon: UserPlus },
      { href: "/contacts?filter=debtors", label: "بدهکاران", icon: ArrowDownCircle },
      { href: "/contacts?filter=creditors", label: "بستانکاران", icon: ArrowUpCircle },
      { href: "/contacts", label: "همه اشخاص", icon: Scale },
    ],
  },
  { href: "/purchases", label: "خرید", icon: ShoppingCart },
  {
    label: "مالی",
    icon: Wallet,
    children: [
      { href: "/finance", label: "تراکنش‌ها", icon: ReceiptText },
      { href: "/finance?type=receipt", label: "دریافت‌ها", icon: ArrowDownCircle },
      { href: "/finance?type=payment", label: "پرداخت‌ها", icon: ArrowUpCircle },
      { href: "/finance?type=expense", label: "هزینه‌ها", icon: Wallet },
      { href: "/reports?tab=financial", label: "گزارش مالی", icon: BarChart2 },
      { href: "/settings", label: "حساب‌های بانکی", icon: Landmark },
    ],
  },
  {
    label: "گزارش‌ها",
    icon: BarChart3,
    children: [
      { href: "/reports?tab=sales", label: "گزارش فروش", icon: TrendingUp },
      { href: "/reports?tab=products", label: "گزارش محصولات", icon: Package },
      { href: "/reports?tab=financial", label: "گزارش مالی", icon: BarChart2 },
      { href: "/reports?tab=contacts", label: "گزارش اشخاص", icon: Users },
    ],
  },
  { href: "/settings", label: "تنظیمات", icon: Settings },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  function toggle(i: number) {
    setExpanded(prev => ({ ...prev, [i]: !prev[i] }));
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />
      )}
      <aside className={cn(
        "fixed lg:sticky top-0 right-0 z-40 h-screen w-64 bg-white border-l border-slate-200 flex flex-col transition-transform duration-200",
        open ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      )}>
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
          {NAV.map((item, i) => {
            const Icon = item.icon;
            const active = isActive(item.href ?? "");
            const hasChildren = !!item.children;

            if (!hasChildren) {
              return (
                <Link key={item.href} href={item.href ?? "#"} onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                    active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                  )}>
                  <Icon size={19} />
                  {item.label}
                </Link>
              );
            }

            const isExpanded = expanded[i] || active;

            return (
              <div key={item.label}>
                <button onClick={() => toggle(i)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                    active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                  )}>
                  <Icon size={19} />
                  <span className="flex-1 text-right">{item.label}</span>
                  <ChevronDown size={15} className={cn("transition-transform shrink-0", isExpanded ? "rotate-180" : "")} />
                </button>
                {isExpanded && item.children && (
                  <div className="mr-3 mt-1 space-y-0.5 pr-3 border-r-2 border-brand-100">
                    {item.children.map(child => {
                      const childActive = isActive(child.href);
                      const ChildIcon = child.icon;
                      return (
                        <Link key={child.href} href={child.href} onClick={onClose}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                            childActive ? "bg-brand-100 text-brand-700 font-medium" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                          )}>
                          <ChildIcon size={15} />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
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
