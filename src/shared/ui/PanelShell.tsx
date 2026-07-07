"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { IconButton } from "./IconButton";

export function PanelShell({ title, subtitle, icon, onClose, actions, footer, children, className }: { title: string; subtitle?: ReactNode; icon?: ReactNode; onClose: () => void; actions?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-card text-card-foreground", className)} dir="rtl">
      <header className="shrink-0 flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {icon && <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div>}
          <div className="min-w-0">
            <h2 className="truncate text-base font-extrabold text-slate-800 dark:text-slate-100">{title}</h2>
            {subtitle && <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {actions}
          <IconButton onClick={onClose} aria-label="بستن پنل"><X size={20} /></IconButton>
        </div>
      </header>
      <main className="min-h-0 flex-1 overscroll-contain overflow-y-auto p-5" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>{children}</main>
      {footer && <footer className="border-t border-border bg-card/95 px-5 py-4 backdrop-blur">{footer}</footer>}
    </div>
  );
}
