"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BarChart3, ChevronRight, Package2, Receipt, ShoppingCart, UserPlus, ArrowDownToLine } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type QuickActionAccent = "primary" | "emerald" | "blue" | "amber" | "rose" | "violet" | "cyan" | "slate";

function QuickActionButton({
  label,
  icon: Icon,
  color,
  accent: accentProp,
  onClick,
  href,
  description,
  badge,
}: {
  label: string;
  icon: LucideIcon;
  color?: string;
  accent?: QuickActionAccent;
  onClick?: () => void;
  href?: string;
  description?: string;
  badge?: string;
}) {
  // map color string like "bg-primary" to accent name
  const accentMap: Record<string, QuickActionAccent> = {
    "bg-primary": "primary",
    "bg-emerald-600": "emerald",
    "bg-blue-600": "blue",
    "bg-slate-600": "slate",
    "bg-cyan-600": "cyan",
    "bg-indigo-600": "violet",
    "bg-rose-600": "rose",
    "bg-amber-600": "amber",
  };
  const accent: QuickActionAccent = accentProp ?? accentMap[color || ""] ?? "primary";

  const accentStyles: Record<QuickActionAccent, { bg: string; text: string; ring: string; hover: string; shadow: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary", ring: "ring-primary/20", hover: "hover:bg-primary/10", shadow: "shadow-primary/10" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-200", hover: "hover:bg-emerald-100", shadow: "shadow-emerald-600/10" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-200", hover: "hover:bg-blue-100", shadow: "shadow-blue-600/10" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-200", hover: "hover:bg-amber-100", shadow: "shadow-amber-600/10" },
    rose: { bg: "bg-rose-50", text: "text-rose-600", ring: "ring-rose-200", hover: "hover:bg-rose-100", shadow: "shadow-rose-600/10" },
    violet: { bg: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-200", hover: "hover:bg-violet-100", shadow: "shadow-violet-600/10" },
    cyan: { bg: "bg-cyan-50", text: "text-cyan-600", ring: "ring-cyan-200", hover: "hover:bg-cyan-100", shadow: "shadow-cyan-600/10" },
    slate: { bg: "bg-slate-100", text: "text-slate-700", ring: "ring-slate-200", hover: "hover:bg-slate-200", shadow: "shadow-slate-600/10" },
  };

  const style = accentStyles[accent];

  const content = (
    <div
      className={cn(
        "relative group w-full rounded-[18px] sm:rounded-[20px] bg-card border border-border p-3 sm:p-4 transition-all duration-200",
        "hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-slate-300",
        "focus:outline-none focus:ring-2 focus:ring-primary/20",
        "text-right",
      )}
    >
      {/* subtle top accent */}
      <div className={cn("absolute top-0 right-4 left-4 h-[3px] rounded-b-full opacity-60", style.text.replace("text-", "bg-"))} />

      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-sm",
            style.bg,
            style.text,
            style.shadow,
          )}
        >
          <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="font-extrabold text-[12px] sm:text-[13px] text-slate-800 leading-tight">{label}</div>
          {description && <div className="text-[11px] text-slate-500 mt-1 leading-snug">{description}</div>}
          {badge && <div className={cn("inline-flex mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full", style.bg, style.text)}>{badge}</div>}
        </div>
      </div>

      {/* chevron hint */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300">
        <ChevronRight size={14} className="rotate-180" />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline">
        {content}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className="w-full text-right">
      {content}
    </button>
  );
}

export function DashboardQuickActions({
  onOpenQuickSale,
  onCreateProduct,
  onCreateContact,
}: {
  onOpenQuickSale: () => void;
  onCreateProduct: () => void;
  onCreateContact: () => void;
}) {
  return (
    <section className="relative">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-primary rounded-full shadow-sm shadow-primary/20" />
          <div>
            <h2 className="text-[15px] font-extrabold text-slate-800">عملیات سریع</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">دسترسی آنی به پرکاربردترین بخش‌ها</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-400">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          آنلاین
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-4">
        <QuickActionButton label="فروش جدید" description="ثبت فاکتور سریع" icon={Receipt} color="bg-primary" badge="F2" onClick={onOpenQuickSale} />
        <QuickActionButton label="خرید کالا" description="ورود موجودی" icon={ShoppingCart} color="bg-emerald-600" href="/purchases" />
        <QuickActionButton label="تعدیل انبار" description="اصلاح موجودی" icon={ArrowDownToLine} color="bg-blue-600" href="/inventory/adjust" />
        <QuickActionButton label="کالای جدید" description="افزودن محصول" icon={Package2} color="bg-slate-600" onClick={onCreateProduct} />
        <QuickActionButton label="مشتری جدید" description="ثبت مخاطب" icon={UserPlus} color="bg-cyan-600" onClick={onCreateContact} />
        <QuickActionButton label="گزارشات" description="تحلیل و آمار" icon={BarChart3} color="bg-indigo-600" href="/reports/sales" />
      </div>
    </section>
  );
}
