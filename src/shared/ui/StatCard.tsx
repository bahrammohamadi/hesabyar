"use client";

import { cn } from "@/lib/utils/cn";
import React, { type ReactNode } from "react";
import Link from "next/link";

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
      "relative overflow-hidden rounded-2xl bg-white/90 border border-white/80 p-4 sm:p-5 shadow-sm shadow-slate-900/[0.04] backdrop-blur transition-all duration-200",
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
      <Link href={href} className="block no-underline focus:outline-none focus:ring-2 focus:ring-primary/30 rounded-2xl">
        {cardInner}
      </Link>
    );
  }

  return cardInner;
}
