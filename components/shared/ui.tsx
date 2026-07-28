"use client";

/**
 * ⚠️ فایل موقت سازگاری (compatibility shim) — منسوخ‌شده
 * =====================================================
 *
 * سیستم اصلی UI پروژه اکنون `src/shared/ui/*` است.
 * این فایل فقط برای اینکه ۳۰ فایل مصرف‌کننده‌ی فعلی بدون تغییر کار کنند نگه داشته شده
 * و به‌تدریج خالی می‌شود. در فایل جدید از این مسیر import نکنید.
 *
 * جزئیات کامل تصمیم: MIGRATION_NOTES.md
 *
 * وضعیت فعلی:
 *
 *   PageHeader  → ✅ منتقل شد به src/shared/ui/PageHeader.tsx  (از آنجا re-export می‌شود)
 *   StatCard    → ✅ منتقل شد به src/shared/ui/StatCard.tsx    (از آنجا re-export می‌شود)
 *
 *   Spinner     → ⏸️ عمداً اینجا مانده. نسخه‌ی src امضای متفاوت دارد
 *                    (label پیش‌فرض «در حال بارگذاری...» + py-8 + رنگ متفاوت).
 *                    سوییچ کردن باعث تغییر ظاهر در ۳۰ محل می‌شود.
 *
 *   EmptyState  → ⏸️ عمداً اینجا مانده. نسخه‌ی src پراپ‌های `icon` و `message` را ندارد
 *                    که در ۱۷ فایل / ۳۴ محل استفاده می‌شوند ⇒ خطای تایپ + تغییر ظاهر.
 *
 *   Modal       → ⏸️ هیچ معادلی در src/shared/ui وجود ندارد (PanelShell جایگزین نیست).
 *
 * سه مورد بالا نیازمند تصمیم صریح هستند و در فاز بعدی رسیدگی می‌شوند.
 */

import { cn } from "@/lib/utils/cn";
import { Loader2, Inbox } from "lucide-react";
import React, { type ReactNode } from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------
// منتقل‌شده به سیستم اصلی — فقط re-export
// ---------------------------------------------------------------------------
export { PageHeader, StatCard } from "@/src/shared/ui";

// ---------------------------------------------------------------------------
// هنوز اینجا — تا زمان تصمیم‌گیری (به توضیح بالای فایل مراجعه کنید)
// ---------------------------------------------------------------------------

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
