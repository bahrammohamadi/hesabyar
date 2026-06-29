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
  TrendingUp, ShoppingBag, BarChart2, Calculator, CreditCard,
  FileText, Percent, ShoppingBasket, Boxes, PercentCircle,
  Building, UserCheck, AlertCircle, PieChart, Activity,
  Briefcase, BookOpen, ShoppingBagIcon, Tags, Barcode,
  ArrowRightLeft, History, PiggyBank, Banknote, Coins,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { href: "/sales", label: "فروش", icon: ShoppingBag, highlight: true },
  { href: "/purchases", label: "خرید", icon: ShoppingBasket },
  {
    label: "کالا و انبار",
    icon: Package,
    children: [
      { href: "/products", label: "کالاها", icon: PackageSearch },
      { href: "/products?action=new", label: "کالای جدید", icon: PlusIcon },
      { href: "/inventory", label: "گردش انبار", icon: ClipboardList },
      { href: "/inventory?type=adjust", label: "تعدیل موجودی", icon: ArrowLeftRight },
      { href: "/inventory?type=in", label: "ورود کالا", icon: ArrowDownToLine },
      { href: "/inventory?type=out", label: "خروج کالا", icon: ArrowUpFromLine },
    ],
  },
  {
    label: "اشخاص",
    icon: Users,
    children: [
      { href: "/contacts", label: "همه اشخاص", icon: Scale },
      { href: "/contacts?type=customer", label: "مشتریان", icon: ShoppingBag },
      { href: "/contacts?type=supplier", label: "تأمین‌کنندگان", icon: Truck },
      { href: "/contacts?action=new&type=customer", label: "مشتری جدید", icon: UserPlus },
      { href: "/contacts?filter=debtors", label: "بدهکاران", icon: ArrowDownCircle },
    ],
  },
  {
    label: "مالی",
    icon: Wallet,
    children: [
      { href: "/finance", label: "تراکنش‌ها", icon: ReceiptText },
      { href: "/finance?type=receipt", label: "دریافت", icon: ArrowDownCircle },
      { href: "/finance?type=payment", label: "پرداخت", icon: ArrowUpCircle },
      { href: "/finance?type=expense", label: "هزینه", icon: Coins },
      { href: "/checks", label: "چک‌ها", icon: CreditCard },
    ],
  },
  {
    label: "فروش پیشرفته",
    icon: FileText,
    children: [
      { href: "/sales/orders", label: "سفارش فروش", icon: ClipboardList },
      { href: "/sales/returns", label: "مرجوعی فروش", icon: ArrowLeftRight },
    ],
  },
  {
    label: "گزارش‌ها",
    icon: BarChart3,
    children: [
      { href: "/reports?tab=sales", label: "فروش", icon: TrendingUp },
      { href: "/reports?tab=products", label: "کالا", icon: Package },
      { href: "/reports?tab=financial", label: "مالی", icon: Wallet },
      { href: "/reports?tab=contacts", label: "اشخاص", icon: Users },
    ],
  },
  {
    label: "تنظیمات",
    icon: Settings,
    children: [
      { href: "/settings", label: "تنظیمات پایه", icon: Layers },
      { href: "/settings#users", label: "کاربران و دسترسی‌ها", icon: UserCheck },
      { href: "/settings", label: "حساب‌ها و دسته‌ها", icon: Landmark },
    ],
  },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  function toggle(i: number) {
    setExpanded(prev => ({ ...prev, [i]: !prev[i] }));
  }

  function isActive(href: string) {
    if (!href) return false;
    return pathname === href || pathname.startsWith(href.split("?")[0] + "/") || pathname.startsWith(href.split("?")[0]);
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
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <img 
              src="/mehrjameh-logo.jpg" 
              alt="مهرجامه" 
              className="w-9 h-9 rounded-xl object-contain bg-white border border-slate-100"
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
            />
            <div className="leading-tight">
              <div className="font-bold text-slate-800 text-sm">مهرجامه</div>
              <div className="text-[10px] text-slate-400">سیستم مدیریت فروش</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.map((item, i) => {
            const Icon = item.icon;
            const active = isActive(item.href ?? "");
            const hasChildren = !!item.children;

            // Special style for highlighted items (like Sales)
            const isHighlight = (item as any).highlight;

            if (!hasChildren) {
              return (
                <Link key={item.href} href={item.href ?? "#"} onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                    active 
                      ? "bg-brand-600 text-white shadow-sm" 
                      : isHighlight
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "text-slate-600 hover:bg-slate-50"
                  )}>
                  <Icon size={18} />
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
                    active 
                      ? "bg-brand-50 text-brand-700" 
                      : "text-slate-600 hover:bg-slate-50"
                  )}>
                  <Icon size={18} />
                  <span className="flex-1 text-right">{item.label}</span>
                  <ChevronDown 
                    size={14} 
                    className={cn("transition-transform duration-200 shrink-0", isExpanded ? "rotate-180" : "")} 
                  />
                </button>

                {isExpanded && item.children && (
                  <div className="mr-2 mt-1 space-y-0.5 pr-3 border-r-2 border-slate-100">
                    {item.children.map((child) => {
                      const childActive = isActive(child.href);
                      const ChildIcon = child.icon;
                      return (
                        <Link key={child.href + child.label} href={child.href} onClick={onClose}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                            childActive 
                              ? "bg-brand-100 text-brand-700 font-medium" 
                              : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                          )}>
                          <ChildIcon size={14} />
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

        {/* Footer */}
        <div className="p-4 border-t border-slate-100">
          <div className="text-xs text-slate-400 text-center">
            مهرجامه — نسخه ۱.۰
          </div>
        </div>
      </aside>
    </>
  );
}
