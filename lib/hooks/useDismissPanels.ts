"use client";

import { useEffect } from "react";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";

/**
 * وقتی یک پنجره‌ی مودال باز می‌شود، پنل‌های کشویی باز را می‌بندد.
 *
 * مشکلی که حل می‌کند:
 *   پروژه دو سیستم لایه‌ای مستقل دارد که از هم خبر ندارند —
 *   PanelManager (کشوی کناری) و Modal (پنجره‌ی وسط صفحه).
 *   وقتی داخل یک کشو روی گزینه‌ای مثل «نمای سریع» کلیک می‌شد،
 *   مودال روی کشو باز می‌شد و کشوی قبلی همان‌جا می‌ماند:
 *   دو لایه‌ی رقیب روی هم، بدون اینکه معلوم باشد کدام فعال است.
 *
 *   حالا با باز شدن مودال، کشوها بسته می‌شوند تا در هر لحظه فقط
 *   یک زمینه‌ی تعاملی وجود داشته باشد.
 *
 * چرا هوک جدا؟
 *   تا هر مودالی با یک خط از آن استفاده کند و لازم نباشد منطق
 *   هماهنگی در هر کامپوننت تکرار شود.
 *
 * @param active آیا مودال هم‌اکنون باز است.
 */
export function useDismissPanels(active: boolean) {
  const { closeAll, stack } = usePanelManager();

  useEffect(() => {
    if (active && stack.length > 0) closeAll();
    // فقط به تغییر «باز شدن» واکنش نشان می‌دهیم، نه به تغییر خود stack،
    // وگرنه بستن دستی یک پنل دوباره این افکت را اجرا می‌کند.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
