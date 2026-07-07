"use client";

import { cn } from "@/lib/utils/cn";
import { Loader2, Inbox, HelpCircle } from "lucide-react";
import React, { type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

function HeaderHelpTip({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <span className="group relative inline-flex align-middle">
      <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary" aria-label="راهنمای این صفحه"><HelpCircle size={14} /></button>
      <span className="pointer-events-none absolute right-0 top-8 z-[1600] hidden w-72 rounded-2xl border border-slate-200 bg-white p-3 text-right text-xs leading-6 text-slate-600 shadow-2xl group-hover:block group-focus-within:block">{text}</span>
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 rounded-[24px] border border-white/70 bg-white/85 p-4 shadow-sm shadow-slate-900/[0.03] backdrop-blur sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 h-1 w-12 rounded-full bg-primary/70" />
          <div className="flex items-center gap-2"><h1 className="truncate text-lg font-extrabold tracking-tight text-slate-800 sm:text-2xl">{title}</h1><HeaderHelpTip text={subtitle} /></div>
          {subtitle && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 sm:text-sm">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

type IconType = React.ElementType | ReactNode;

export function StatCard({
  title,
  label,
  value,
  hint,
  subValue,
  icon,
  tone = "default",
  trend,
  href,
  color,
}: {
  title?: string;
  label?: string;
  value: ReactNode;
  hint?: string;
  subValue?: ReactNode;
  icon?: IconType;
  tone?: "default" | "green" | "red" | "amber" | "blue" | "primary" | "violet" | "cyan";
  trend?: "up" | "down" | "neutral";
  href?: string;
  // رنگ آیکون - برای سازگاری با تم
  color?: "primary" | "emerald" | "blue" | "amber" | "rose" | "violet" | "cyan" | "slate";
}) {
  const displayTitle = label ?? title ?? "";
  const displayHint = subValue ?? hint;

  // تعیین رنگ بر اساس trend یا color prop یا tone
  type ColorCfg = { bg: string; text: string; soft: string; border: string; accent: string };
  const getColorConfig = (): ColorCfg => {
    // اولویت: color prop > trend > tone
    if (color) {
      const map: Record<string, { bg: string; text: string; soft: string; border: string; accent: string }> = {
        primary: { bg: "bg-primary/10", text: "text-primary", soft: "bg-primary/5", border: "border-primary/20", accent: "bg-primary" },
        emerald: { bg: "bg-emerald-50", text: "text-emerald-600", soft: "bg-emerald-50/50", border: "border-emerald-100", accent: "bg-emerald-600" },
        blue: { bg: "bg-blue-50", text: "text-blue-600", soft: "bg-blue-50/50", border: "border-blue-100", accent: "bg-blue-600" },
        amber: { bg: "bg-amber-50", text: "text-amber-600", soft: "bg-amber-50/50", border: "border-amber-100", accent: "bg-amber-600" },
        rose: { bg: "bg-rose-50", text: "text-rose-600", soft: "bg-rose-50/50", border: "border-rose-100", accent: "bg-rose-600" },
        violet: { bg: "bg-violet-50", text: "text-violet-600", soft: "bg-violet-50/50", border: "border-violet-100", accent: "bg-violet-600" },
        cyan: { bg: "bg-cyan-50", text: "text-cyan-600", soft: "bg-cyan-50/50", border: "border-cyan-100", accent: "bg-cyan-600" },
        slate: { bg: "bg-slate-100", text: "text-slate-600", soft: "bg-slate-50", border: "border-slate-200", accent: "bg-slate-600" },
      };
      return map[color] ?? map.primary;
    }
    if (trend === "up") return { bg: "bg-emerald-50", text: "text-emerald-600", soft: "bg-emerald-50/50", border: "border-emerald-100", accent: "bg-emerald-600" };
    if (trend === "down") return { bg: "bg-rose-50", text: "text-rose-600", soft: "bg-rose-50/50", border: "border-rose-100", accent: "bg-rose-600" };
    // tone mapping
    const toneMap: Record<string, ColorCfg> = {
      green: { bg: "bg-emerald-50", text: "text-emerald-600", soft: "bg-emerald-50/50", border: "border-emerald-100", accent: "bg-emerald-600" },
      red: { bg: "bg-rose-50", text: "text-rose-600", soft: "bg-rose-50/50", border: "border-rose-100", accent: "bg-rose-600" },
      amber: { bg: "bg-amber-50", text: "text-amber-600", soft: "bg-amber-50/50", border: "border-amber-100", accent: "bg-amber-600" },
      blue: { bg: "bg-blue-50", text: "text-blue-600", soft: "bg-blue-50/50", border: "border-blue-100", accent: "bg-blue-600" },
      primary: { bg: "bg-primary/10", text: "text-primary", soft: "bg-primary/5", border: "border-primary/20", accent: "bg-primary" },
      violet: { bg: "bg-violet-50", text: "text-violet-600", soft: "bg-violet-50/50", border: "border-violet-100", accent: "bg-violet-600" },
      cyan: { bg: "bg-cyan-50", text: "text-cyan-600", soft: "bg-cyan-50/50", border: "border-cyan-100", accent: "bg-cyan-600" },
      default: { bg: "bg-primary/10", text: "text-primary", soft: "bg-muted/50", border: "border-border", accent: "bg-primary" },
    };
    return toneMap[tone] ?? toneMap.default;
  };

  const colors = getColorConfig();

  const trendBadge = trend ? {
    up: { text: "text-emerald-700", bg: "bg-emerald-50", icon: "↗", label: "صعودی" },
    down: { text: "text-rose-700", bg: "bg-rose-50", icon: "↘", label: "نزولی" },
    neutral: { text: "text-slate-500", bg: "bg-slate-50", icon: "→", label: "پایدار" },
  }[trend] : null;

  const renderIcon = () => {
    if (!icon) return null;
    
    let iconNode: ReactNode = null;
    if (React.isValidElement(icon)) {
      iconNode = icon;
    } else {
      try {
        const IconComp = icon as React.ElementType;
        iconNode = <IconComp size={20} />;
      } catch {
        iconNode = icon as ReactNode;
      }
    }

    return (
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-105", colors.bg, colors.text)}>
        {iconNode}
      </div>
    );
  };

  const cardInner = (
    <div className={cn(
      "relative overflow-hidden rounded-[24px] bg-white/90 border border-white/80 p-4 sm:p-5 shadow-sm shadow-slate-900/[0.04] backdrop-blur transition-all duration-200",
      "hover:shadow-xl hover:shadow-slate-900/[0.08] hover:-translate-y-0.5",
      "hover:border-primary/25",
      href && "cursor-pointer group"
    )}>
      {/* نوار رنگی بالا - theme aware */}
      <div className={cn("absolute top-0 inset-x-0 h-[3px]", colors.accent)} />
      
      <div className="flex items-start justify-between mb-3 pt-1">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-muted-foreground mb-1">{displayTitle}</div>
          <div className="text-2xl sm:text-[26px] font-black text-slate-900 tracking-tight leading-tight tabular-nums">
            {value ?? "—"}
          </div>
        </div>
        {renderIcon()}
      </div>
      
      <div className="flex items-center justify-between gap-2 min-h-[22px]">
        <div className="flex-1 min-w-0">
          {displayHint && (
            <div className="text-xs text-slate-500 truncate">{displayHint}</div>
          )}
        </div>
        {trendBadge && (
          <div className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold", trendBadge.bg, trendBadge.text)}>
            <span>{trendBadge.icon}</span>
            <span className="hidden sm:inline">{trendBadge.label}</span>
          </div>
        )}
      </div>

      {/* دکور پس‌زمینه محو */}
      <div className={cn("absolute -left-6 -bottom-6 w-20 h-20 rounded-full opacity-[0.04] pointer-events-none", colors.accent)} />
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline focus:outline-none focus:ring-2 focus:ring-primary/30 rounded-[20px]">
        {cardInner}
      </Link>
    );
  }

  return cardInner;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
      <Loader2 className="animate-spin" size={20} />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  message,
  action,
}: {
  icon?: React.ElementType;
  title?: string;
  description?: string;
  message?: string;
  action?: ReactNode;
}) {
  const displayTitle = title ?? message ?? "اطلاعاتی موجود نیست";
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
        {Icon ? <Icon size={26} /> : <Inbox size={26} />}
      </div>
      <h3 className="font-semibold text-slate-700">{displayTitle}</h3>
      {description && <p className="text-sm text-slate-400 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  mobileFullscreen = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
  mobileFullscreen?: boolean;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ zIndex: "var(--z-modal)" }}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-t-[24px] bg-white shadow-2xl max-h-[92vh] sm:rounded-2xl",
          mobileFullscreen ? "flex h-[92vh] flex-col sm:h-auto" : "overflow-y-auto",
          size === "xl" ? "sm:max-w-6xl" : size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
      >
        <div className="sticky top-0 z-10 shrink-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            ×
          </button>
        </div>
        <div className={cn("p-5", mobileFullscreen && "flex min-h-0 flex-1 flex-col overflow-y-auto")}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
