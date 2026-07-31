"use client";

import { cn } from "@/lib/utils/cn";
import { HelpCircle } from "lucide-react";
import { type ReactNode } from "react";

/**
 * راهنمای هدر صفحه.
 *
 * ⚠️ عمداً از `HelpTip` موجود در همین پوشه استفاده نمی‌کند.
 * ابعاد و استایل این نسخه متفاوت است (h-6/w-6 و آیکون ۱۴ و عرض w-72،
 * در برابر h-5/w-5 و آیکون ۱۳ و عرض w-64 در HelpTip).
 * یکسان‌سازی این دو یک تغییر بصری است و به فاز بازطراحی موکول شده.
 */
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
    <div className="mb-6 rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm shadow-slate-900/[0.03] backdrop-blur sm:p-5">
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
