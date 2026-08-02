"use client";

import { useEffect, useState } from "react";

/**
 * آیا عرض صفحه زیر بریک‌پوینت داده‌شده است؟
 *
 * برای تصمیم‌هایی لازم است که در CSS قابل بیان نیستند — مثل تعداد
 * تیک محور نمودار که باید به‌صورت prop به Recharts داده شود.
 *
 * مقدار اولیه `false` است و بعد از mount اصلاح می‌شود، تا رندر سرور و
 * کلاینت یکسان بمانند (وگرنه hydration mismatch می‌دهد).
 */
export function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [breakpoint]);

  return isMobile;
}
