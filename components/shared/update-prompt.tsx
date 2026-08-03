"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { BRAND_VERSION } from "@/lib/brand";
import { toFaDigits } from "@/lib/utils/format";

/**
 * اعلان «نسخه‌ی تازه آمده».
 *
 * نسخه‌ای که این صفحه با آن بارگذاری شده در باندل ثابت است؛ سرور
 * نسخه‌ی واقعیِ در حال اجرا را برمی‌گرداند. تفاوت این دو یعنی
 * دیپلوی تازه‌ای انجام شده در حالی که تب کاربر باز بوده.
 *
 * چرا خودکار رفرش نمی‌کنیم؟
 *   کاربر ممکن است وسط پرکردن فاکتور باشد. رفرش ناگهانی یعنی از
 *   دست رفتن کار. پس فقط اطلاع می‌دهیم و تصمیم با اوست.
 */
export function UpdatePrompt() {
  const [serverVersion, setServerVersion] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function check() {
      // در تب پنهان بی‌فایده است و فقط درخواست هدر می‌دهد.
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { version?: string };
        if (alive && json.version) setServerVersion(json.version);
      } catch {
        /* آفلاین یا خطای شبکه — دفعه‌ی بعد */
      }
    }

    check();
    const timer = setInterval(check, 5 * 60_000);
    // وقتی کاربر به تب برمی‌گردد، احتمال دیپلوی در این فاصله زیاد است.
    const onVisible = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const outdated = serverVersion !== null && serverVersion !== BRAND_VERSION;
  if (!outdated) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 max-w-[calc(100vw-2rem)] animate-slide-in rounded-2xl border border-primary/30 bg-card p-3.5 shadow-2xl motion-reduce:animate-none sm:max-w-sm"
      style={{ zIndex: "var(--z-toast)" }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles size={17} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-foreground">نسخه‌ی تازه آماده است</p>
          <p className="mt-0.5 text-2xs leading-5 text-muted-foreground">
            نسخه‌ی {toFaDigits(serverVersion!)} منتشر شده؛ شما روی {toFaDigits(BRAND_VERSION)} هستید.
            برای دریافت تغییرات صفحه را نو کنید.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2.5 inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-2xs font-extrabold text-primary-foreground transition hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <RefreshCw size={13} aria-hidden />
            به‌روزرسانی
          </button>
        </div>
      </div>
    </div>
  );
}
