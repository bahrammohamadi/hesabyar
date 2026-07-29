"use client";

import { Eye } from "lucide-react";
import { useOrg } from "@/lib/hooks/useOrg";

/**
 * نوار هشدار «حالت نمایشی».
 *
 * فقط وقتی سازمان جاری `is_demo = true` باشد رندر می‌شود، پس برای
 * کاربران عادی هیچ تغییری ایجاد نمی‌کند.
 */
export function DemoBanner() {
  const { isDemo, loading } = useOrg();

  if (loading || !isDemo) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-warning/25 bg-warning-soft px-4 py-2 text-center text-xs font-bold text-warning"
    >
      <Eye size={14} className="shrink-0" />
      <span>
        حالت نمایشی — این یک کسب‌وکار آزمایشی است و امکان حذف داده در آن غیرفعال شده است.
      </span>
    </div>
  );
}
