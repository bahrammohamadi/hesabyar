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
 *   Modal       → ✅ منتقل شد به src/shared/ui/Modal.tsx       (از آنجا re-export می‌شود)
 *
 *   EmptyState  → ⏸️ نسخه‌ی src اکنون از نظر پراپ سازگار شده (icon/message اضافه شد)
 *                    اما هنوز re-export نمی‌شود: ظاهرش کادر خط‌چین دارد
 *                    (border-dashed + p-8) در حالی که نسخه‌ی قدیمی بدون کادر است
 *                    (py-16) ⇒ تغییر بصری خاموش در ۱۷ فایل. نیازمند تصمیم صریح.
 *
 *   Spinner     → ⏸️ عمداً اینجا مانده. نسخه‌ی src مقدار پیش‌فرض
 *                    «در حال بارگذاری...» دارد ⇒ در ۳۰ محل <Spinner /> بدون پراپ،
 *                    متن ناگهان ظاهر می‌شود. کامپایلر این را نمی‌گیرد.
 *                    نیازمند تصمیم صریح.
 */

import { Loader2, Inbox } from "lucide-react";
import type { ElementType, ReactNode } from "react";

// ---------------------------------------------------------------------------
// منتقل‌شده به سیستم اصلی — فقط re-export
// ---------------------------------------------------------------------------
export { PageHeader, StatCard, Modal } from "@/src/shared/ui";

// ---------------------------------------------------------------------------
// هنوز اینجا — تا زمان تصمیم‌گیری (به توضیح بالای فایل مراجعه کنید)
// ---------------------------------------------------------------------------

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
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
  icon?: ElementType;
  title?: string;
  description?: string;
  message?: string;
  action?: ReactNode;
}) {
  const displayTitle = title ?? message ?? "اطلاعاتی موجود نیست";
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mb-4">
        {Icon ? <Icon size={26} /> : <Inbox size={26} />}
      </div>
      <h3 className="font-semibold text-foreground">{displayTitle}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
