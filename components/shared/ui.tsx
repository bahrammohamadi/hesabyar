"use client";

import { cn } from "@/lib/utils/cn";
import { Loader2, Inbox } from "lucide-react";
import React, { type ReactNode } from "react";
import Link from "next/link";

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
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
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
}: {
  title?: string;
  label?: string;
  value: ReactNode;
  hint?: string;
  subValue?: ReactNode;
  icon?: IconType;
  tone?: "default" | "green" | "red" | "amber" | "blue";
  trend?: "up" | "down" | "neutral";
  href?: string;
}) {
  const displayTitle = label ?? title ?? "";
  const displayHint = subValue ?? hint;

  const tones: Record<string, string> = {
    default: "bg-white",
    green: "bg-emerald-50 border-emerald-100",
    red: "bg-rose-50 border-rose-100",
    amber: "bg-amber-50 border-amber-100",
    blue: "bg-brand-50 border-brand-100",
  };

  const trendColors: Record<string, string> = {
    up: "text-emerald-600",
    down: "text-rose-600",
    neutral: "text-slate-400",
  };

  const renderIcon = () => {
    if (!icon) return null;
    
    // اگر قبلا یک React Element است (مثلا <Wallet size={20} />)
    if (React.isValidElement(icon)) {
      return <span className={trend ? trendColors[trend] : "text-slate-400"}>{icon}</span>;
    }
    
    // اگر یک کامپوننت است (function یا forwardRef object مثل Lucide icons)
    // Lucide icons are ForwardRefExoticComponent -> typeof === 'object'
    try {
      const IconComp = icon as React.ElementType;
      // @ts-ignore - Lucide icons accept size prop
      return <IconComp size={20} className={trend ? trendColors[trend] : "text-slate-400"} />;
    } catch (e) {
      // fallback: render as-is if it's a valid ReactNode
      return <span className={trend ? trendColors[trend || "neutral"] : "text-slate-400"}>{icon as ReactNode}</span>;
    }
  };

  const cardInner = (
    <div className={cn("card p-4 sm:p-5 transition-all hover:shadow-md", tones[tone], href ? "hover:border-brand-200 cursor-pointer group" : "")}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{displayTitle}</span>
        {renderIcon()}
      </div>
      <div className="mt-2 text-lg sm:text-xl font-bold text-slate-800">{value}</div>
      {displayHint && <div className="mt-1 text-xs text-slate-400">{displayHint}</div>}
      {trend && (
        <div className={cn("mt-1 text-[11px] font-medium", trendColors[trend])}>
          {trend === "up" && "▲ روند صعودی"}
          {trend === "down" && "▼ روند نزولی"}
          {trend === "neutral" && "— پایدار"}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline">
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
  size?: "md" | "lg";
  mobileFullscreen?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          "relative bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto",
          mobileFullscreen ? "h-[92vh] sm:h-auto" : "",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
