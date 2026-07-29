"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  BarChart3,
  Package2,
  Receipt,
  ShoppingCart,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Accent = "primary" | "emerald" | "blue" | "slate" | "cyan" | "violet";

// همه‌ی رنگ‌ها از توکن‌های معنایی پروژه — سازگار با دارک‌مود و تعویض تم.
const ACCENT: Record<Accent, { icon: string; label: string; ring: string }> = {
  primary: { icon: "bg-primary/10 text-primary", label: "text-primary", ring: "hover:ring-primary/20" },
  emerald: { icon: "bg-success/10 text-success", label: "text-success", ring: "hover:ring-success/20" },
  blue:    { icon: "bg-info/10 text-info",       label: "text-info",    ring: "hover:ring-info/20" },
  slate:   { icon: "bg-muted text-foreground/70",label: "text-foreground/70", ring: "hover:ring-border" },
  cyan:    { icon: "bg-info/10 text-info",       label: "text-info",    ring: "hover:ring-info/20" },
  violet:  { icon: "bg-accent text-accent-foreground", label: "text-accent-foreground", ring: "hover:ring-border" },
};

function QuickBtn({
  label,
  icon: Icon,
  accent,
  badge,
  onClick,
  href,
}: {
  label: string;
  icon: LucideIcon;
  accent: Accent;
  badge?: string;
  onClick?: () => void;
  href?: string;
}) {
  const a = ACCENT[accent];

  const inner = (
    <div
      className={cn(
        "group relative flex h-full flex-col items-center gap-2 rounded-2xl border border-border bg-card py-4 px-3 shadow-sm transition-all duration-150",
        "hover:-translate-y-0.5 hover:shadow-md",
        "ring-2 ring-transparent",
        a.ring,
      )}
    >
      {/* آیکون */}
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-150 group-hover:scale-110", a.icon)}>
        <Icon size={20} strokeWidth={2} />
      </div>

      {/* لیبل */}
      <span className="text-center text-[12px] font-bold leading-tight text-foreground/80">{label}</span>

      {/* badge کیبورد */}
      {badge && (
        <span className="absolute left-2 top-2 hidden rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground lg:block">
          {badge}
        </span>
      )}
    </div>
  );

  if (href) return <Link href={href} className="block h-full no-underline">{inner}</Link>;
  return <button onClick={onClick} className="h-full w-full">{inner}</button>;
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
    <section>
      <div className="mb-3 flex items-center gap-2">
        <div className="h-4 w-1 rounded-full bg-primary" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">عملیات سریع</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5 md:grid-cols-6">
        <QuickBtn label="فروش جدید"   icon={Receipt}        accent="primary" badge="F2" onClick={onOpenQuickSale} />
        <QuickBtn label="خرید کالا"   icon={ShoppingCart}   accent="emerald"            href="/purchases" />
        <QuickBtn label="تعدیل انبار" icon={ArrowDownToLine} accent="blue"              href="/inventory/adjust" />
        <QuickBtn label="کالای جدید"  icon={Package2}        accent="slate"             onClick={onCreateProduct} />
        <QuickBtn label="مشتری جدید"  icon={UserPlus}        accent="cyan"              onClick={onCreateContact} />
        <QuickBtn label="گزارشات"     icon={BarChart3}       accent="violet"            href="/reports/sales" />
      </div>
    </section>
  );
}
