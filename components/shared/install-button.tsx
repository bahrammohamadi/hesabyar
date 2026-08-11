"use client";

import { useState } from "react";
import { Download, Share, X } from "lucide-react";
import { canOfferInstall, iosInstallSteps } from "@/lib/pwa";
import { useInstallState } from "./install-store";
import { BRAND_NAME } from "@/lib/brand";
import { toFaDigits } from "@/lib/utils/format";

/**
 * دکمه‌ی دائمی «نصب برنامه» در هدر، کنار زنگوله‌ی اعلان‌ها.
 *
 * چرا لازم بود؟
 *   بنر خودکار حالا خیلی محدود شده (فقط داشبورد، فقط موبایل، فقط
 *   یک‌بار در هر نشست). بدون یک راه دائمی، کاربری که یک‌بار «بعداً»
 *   زده تا ۳۰ روز هیچ راهی برای نصب نداشت جز اینکه منوی مرورگر را
 *   بلد باشد. خواسته‌ی خود کاربر هم همین بود: «یه دکمه نصب بالای
 *   صفحه کنار زنگوله نوتیفیکیشن هم بد نیس».
 *
 * ⚠️ اگر نصب ممکن نباشد دکمه اصلاً رندر نمی‌شود — نه اینکه غیرفعال
 * شود. دکمه‌ی خاکستریِ بی‌توضیح، کاربر را سردرگم می‌کند و روی
 * دسکتاپِ اپِ نصب‌شده اصلاً معنا ندارد.
 */
export function InstallButton() {
  const { mode, ready, install } = useInstallState();
  const [helpOpen, setHelpOpen] = useState(false);

  if (!ready || !canOfferInstall(mode)) return null;

  async function handleClick() {
    if (mode === "prompt") {
      await install();
      return;
    }
    // iOS: دیالوگ نصبی وجود ندارد؛ فقط می‌شود مسیر دستی را نشان داد.
    setHelpOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="نصب برنامه روی دستگاه"
        title="نصب برنامه"
        className="relative flex h-11 items-center justify-center gap-1.5 rounded-2xl px-2.5 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
      >
        <Download size={18} aria-hidden />
        {/* متن فقط در فضای کافی؛ در موبایل آیکون تنها می‌ماند و aria-label کارش را می‌کند. */}
        <span className="hidden text-2xs font-bold lg:inline">نصب برنامه</span>
      </button>

      {helpOpen && (
        <div
          role="dialog"
          aria-labelledby="install-help-title"
          className="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[1400] mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-lg lg:bottom-4 lg:left-auto lg:right-4 lg:mx-0"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="install-help-title" className="text-sm font-extrabold text-foreground">
              <Share size={15} className="ml-1 inline text-primary" aria-hidden />
              نصب {BRAND_NAME} روی آیفون
            </h2>
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              aria-label="بستن راهنمای نصب"
              className="shrink-0 rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X size={15} aria-hidden />
            </button>
          </div>
          <ol className="mt-3 space-y-1.5">
            {iosInstallSteps().map((step, index) => (
              <li key={step} className="flex gap-2 text-2xs leading-6 text-muted-foreground">
                <span className="shrink-0 font-extrabold text-primary">
                  {toFaDigits(index + 1)}.
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}
