"use client";

import { Loader2, Inbox } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Spinner({ label = "در حال بارگذاری..." }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={18} />{label}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-muted", className)} />;
}

/**
 * حالت خالی.
 *
 * پراپ‌های `icon` و `message` برای سازگاری با نسخه‌ی قدیمی
 * (`components/shared/ui.tsx`) اضافه شده‌اند تا مهاجرت ۳۴ محل در ۱۷ فایل
 * بدون تغییر در محل فراخوانی ممکن شود:
 *   - `icon`    : کامپوننت آیکون lucide؛ در نبودش `Inbox` استفاده می‌شود
 *   - `message` : نام قدیمی `title` (وقتی `title` داده نشده باشد)
 */
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
  const displayTitle = title ?? message ?? "داده‌ای وجود ندارد";
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">{Icon ? <Icon size={24} /> : <Inbox size={24} />}</div>
      <div className="font-extrabold text-foreground">{displayTitle}</div>
      {description && <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
