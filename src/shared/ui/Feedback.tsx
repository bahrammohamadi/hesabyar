"use client";

import { Loader2, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Spinner({ label = "در حال بارگذاری..." }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={18} />{label}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-muted", className)} />;
}

export function EmptyState({ title = "داده‌ای وجود ندارد", description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><Inbox size={24} /></div>
      <div className="font-extrabold text-slate-700 dark:text-slate-200">{title}</div>
      {description && <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
