"use client";

import { cn } from "@/lib/utils/cn";
import React, { type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * دیالوگ overlay با backdrop، رندرشده در document.body از طریق createPortal.
 *
 * ⚠️ این کامپوننت جایگزین PanelShell نیست:
 *   - Modal  → دیالوگ کوتاه، تأیید، فرم‌های سریع (open/onClose، backdrop، size)
 *   - PanelShell → پنل کشویی موجودیت‌ها، درون PanelHost و Panel Stack
 *
 * برای فرم‌های ساخت/ویرایش موجودیت‌ها از سیستم PanelManager استفاده کنید.
 *
 * کد عیناً از components/shared/ui.tsx منتقل شده — بدون تغییر بصری.
 */
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
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} aria-hidden />
      {/*
        role=dialog + aria-modal یک landmark می‌سازد؛ بدون آن، محتوای
        مودال «خارج از landmark» شمرده می‌شد (region violation).
      */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cn(
          "relative w-full overflow-hidden rounded-t-[24px] bg-card shadow-2xl max-h-[92vh] sm:rounded-2xl",
          mobileFullscreen ? "flex h-[92vh] flex-col sm:h-auto" : "overflow-y-auto",
          size === "xl" ? "sm:max-w-6xl" : size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
      >
        <div className="sticky top-0 z-10 shrink-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} aria-label="بستن" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground text-xl leading-none">
            ×
          </button>
        </div>
        <div className={cn("p-5", mobileFullscreen && "flex min-h-0 flex-1 flex-col overflow-y-auto")}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
