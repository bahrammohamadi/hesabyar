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

  /*
    نگاشت تونالیته → توکن معنایی.

    قبلاً هر تونالیته رنگ خام Tailwind بود (bg-emerald-50، text-rose-600، …)
    که سه مشکل داشت: در دارک‌مود نمی‌چرخید، به تعویض تم واکنش نمی‌داد و
    کنتراست متن روی پس‌زمینه‌ی نرم زیر حد WCAG بود (مثلاً emerald-600
    روی سفید ۳.۷۶). حالا از توکن‌های on-soft استفاده می‌شود که
    برای همین منظور تعریف شده‌اند.

    تمایز بصری بین تونالیته‌ها حفظ شده — فقط منبع رنگ عوض شده.
  */
  type ColorCfg = { bg: string; text: string; soft: string; border: string; accent: string };

  const TOKENS: Record<string, ColorCfg> = {
    primary: { bg: "bg-primary/10", text: "text-primary", soft: "bg-primary/5", border: "border-primary/20", accent: "bg-primary" },
    success: { bg: "bg-success-soft", text: "text-success-onSoft", soft: "bg-success-soft/50", border: "border-success/20", accent: "bg-success" },
    danger:  { bg: "bg-destructive/10", text: "text-destructive", soft: "bg-destructive/5", border: "border-destructive/20", accent: "bg-destructive" },
    warning: { bg: "bg-warning-soft", text: "text-warning-onSoft", soft: "bg-warning-soft/50", border: "border-warning/25", accent: "bg-warning" },
    info:    { bg: "bg-info-soft", text: "text-info-onSoft", soft: "bg-info-soft/50", border: "border-info/20", accent: "bg-info" },
    neutral: { bg: "bg-muted", text: "text-muted-foreground", soft: "bg-muted/50", border: "border-border", accent: "bg-muted-foreground" },
  };

  const getColorConfig = (): ColorCfg => {
    // اولویت: color prop > trend > tone
    if (color) {
      const byColor: Record<string, ColorCfg> = {
        primary: TOKENS.primary,
        emerald: TOKENS.success,
        blue: TOKENS.info,
        cyan: TOKENS.info,
        amber: TOKENS.warning,
        rose: TOKENS.danger,
        violet: TOKENS.primary,
        slate: TOKENS.neutral,
      };
      return byColor[color] ?? TOKENS.primary;
    }
    if (trend === "up") return TOKENS.success;
    if (trend === "down") return TOKENS.danger;

    const byTone: Record<string, ColorCfg> = {
      green: TOKENS.success,
      red: TOKENS.danger,
      amber: TOKENS.warning,
      blue: TOKENS.info,
      cyan: TOKENS.info,
      primary: TOKENS.primary,
      violet: TOKENS.primary,
      default: TOKENS.primary,
    };
    return byTone[tone] ?? byTone.default;
  };

  const colors = getColorConfig();

  const trendBadge = trend ? {
    up: { text: "text-success-onSoft", bg: "bg-success-soft", icon: "↗", label: "صعودی" },
    down: { text: "text-destructive", bg: "bg-destructive/10", icon: "↘", label: "نزولی" },
    neutral: { text: "text-muted-foreground", bg: "bg-muted", icon: "→", label: "پایدار" },
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
      "relative overflow-hidden rounded-2xl bg-card/90 border border-border p-4 sm:p-5 shadow-sm backdrop-blur transition-all duration-200",
      "hover:shadow-xl hover:-translate-y-0.5",
      "hover:border-primary/25",
      href && "cursor-pointer group"
    )}>
      {/* نوار رنگی بالا - theme aware */}
      <div className={cn("absolute top-0 inset-x-0 h-[3px]", colors.accent)} />
      
      <div className="flex items-start justify-between mb-3 pt-1">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-muted-foreground mb-1">{displayTitle}</div>
          <div className="text-2xl sm:text-2xl font-black text-foreground tracking-tight leading-tight tabular-nums">
            {value ?? "—"}
          </div>
        </div>
        {renderIcon()}
      </div>
      
      <div className="flex items-center justify-between gap-2 min-h-[22px]">
        <div className="flex-1 min-w-0">
          {displayHint && (
            <div className="text-xs text-muted-foreground truncate">{displayHint}</div>
          )}
        </div>
        {trendBadge && (
          <div className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-bold", trendBadge.bg, trendBadge.text)}>
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
