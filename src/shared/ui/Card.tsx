"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { HelpTip } from "./HelpTip";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-border bg-card text-card-foreground shadow-sm", className)} {...props} />;
}

/**
 * بخش کارت‌دار با عنوان.
 *
 * `as` سطح عنوان را کنترل می‌کند. پیش‌فرض h2 است، نه h3:
 * صفحات با h1 (از PageHeader) شروع می‌شوند و پرش مستقیم به h3
 * ساختار عناوین را می‌شکست — axe آن را heading-order گزارش می‌کرد
 * و صفحه‌خوان سلسله‌مراتب را اشتباه اعلام می‌کند.
 */
export function Section({ title, description, action, children, className, as: Heading = "h2" }: { title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string; as?: "h2" | "h3" | "h4" }) {
  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      {(title || description || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <Heading className="flex items-center gap-1.5 text-sm font-extrabold text-foreground"><span>{title}</span><HelpTip text={description} /></Heading>}
            {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </Card>
  );
}
