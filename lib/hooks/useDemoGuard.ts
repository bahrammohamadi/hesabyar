"use client";

import { useCallback } from "react";
import { useOrg } from "@/lib/hooks/useOrg";
import { useToast } from "@/src/shared/ui";

/**
 * محافظ عملیات مخرب در حالت نمایشی.
 *
 * الگوی استفاده:
 *   const { blocked, guard } = useDemoGuard();
 *   if (guard()) return;          // در دمو: پیام می‌دهد و true برمی‌گرداند
 *   ...ادامه‌ی حذف/ابطال
 *
 * ⚠️ این فقط یک لایه‌ی UX است، نه امنیت. سازمان دمو داده‌ی واقعی مشتری
 * ندارد، پس دور زدنش خطری ندارد. اگر روزی لازم شد سخت‌گیرانه شود، باید
 * در سطح RLS/RPC اعمال گردد.
 */
export function useDemoGuard() {
  const { isDemo } = useOrg();
  const { toast } = useToast();

  const guard = useCallback(
    (action = "این عملیات") => {
      if (!isDemo) return false;
      toast({
        tone: "warning",
        title: "حالت نمایشی",
        description: `${action} در کسب‌وکار آزمایشی غیرفعال است.`,
      });
      return true;
    },
    [isDemo, toast]
  );

  return { blocked: isDemo, guard };
}
