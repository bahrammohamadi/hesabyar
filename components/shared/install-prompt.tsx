"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, Smartphone, X } from "lucide-react";
import { Button } from "@/src/shared/ui";
import {
  INSTALL_DISMISS_KEY,
  INSTALL_SESSION_KEY,
  iosInstallSteps,
  shouldAutoPrompt,
} from "@/lib/pwa";
import { useInstallState } from "./install-store";
import { BRAND_NAME } from "@/lib/brand";
import { toFaDigits } from "@/lib/utils/format";

/**
 * بنر خودکار پیشنهاد نصب.
 *
 * ⚠️ رویداد `beforeinstallprompt` استاندارد نیست و فقط در کروم/اج
 * وجود دارد. سافاری iOS هیچ راه برنامه‌نویسی‌شده‌ای برای نصب ندارد —
 * تنها کار ممکن نشان‌دادن راهنمای دستی است. برای همین *هیچ‌جا* دکمه‌ای
 * نشان نمی‌دهیم که کلیک شود و کار نکند.
 *
 * 🔴 بازنگری پس از بازخورد کاربر:
 *   نسخه‌ی قبلی این بنر را در **هر صفحه**، روی **هر اندازه‌ی صفحه** و
 *   با **هر بار رفرش** نشان می‌داد. تنها ترمز، کلیک روی «بعداً» بود؛
 *   کسی که نادیده می‌گرفت، در بارگذاری بعدی دوباره همان را می‌دید.
 *
 *   حالا شرط‌ها در `shouldAutoPrompt` جمع شده‌اند (تابع خالص و تست‌شده):
 *   فقط داشبورد، فقط موبایل، فقط یک‌بار در هر نشست.
 *
 *   راه دسترسی دائمی از بین نرفته: دکمه‌ی «نصب برنامه» کنار زنگوله‌ی
 *   اعلان‌ها همیشه هست (`InstallButton`).
 */
export function InstallPrompt() {
  const pathname = usePathname();
  const { mode, ready, install } = useInstallState();
  const [open, setOpen] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (open) return;

    /*
      تأخیر عمدی: نشان‌دادن پیشنهاد نصب در ثانیه‌ی اول ورود مزاحمت
      است. کاربر باید اول داشبوردش را ببیند.
    */
    const timer = window.setTimeout(() => {
      const allowed = shouldAutoPrompt({
        mode,
        pathname: pathname ?? "",
        viewportWidth: window.innerWidth,
        shownThisSession: window.sessionStorage.getItem(INSTALL_SESSION_KEY) === "1",
        dismissedRaw: window.localStorage.getItem(INSTALL_DISMISS_KEY),
      });
      if (!allowed) return;
      /*
        همین‌جا علامت می‌زنیم، نه هنگام بستن. اگر منتظر بستن بمانیم،
        کاربری که بنر را نادیده می‌گیرد و رفرش می‌کند دوباره آن را
        می‌بیند — یعنی دقیقاً همان باگی که گزارش شد.
      */
      window.sessionStorage.setItem(INSTALL_SESSION_KEY, "1");
      setOpen(true);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [ready, mode, pathname, open]);

  /** «بعداً» = تا ۳۰ روز دیگر بنر خودکار نیاید. */
  function dismiss() {
    setOpen(false);
    window.localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
  }

  async function handleInstall() {
    const outcome = await install();
    if (outcome === "accepted") setOpen(false);
    else dismiss();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="install-title"
      /*
        بالای نوار پایین موبایل (۶۸px) می‌نشیند تا رویش نیفتد.
      */
      className="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[1400] mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Smartphone size={19} aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <h2 id="install-title" className="text-sm font-extrabold text-foreground">
            {BRAND_NAME} را روی گوشی نصب کنید
          </h2>
          <p className="mt-1 text-2xs leading-6 text-muted-foreground">
            مثل یک برنامه‌ی معمولی باز می‌شود — بدون نوار مرورگر و با آیکون روی صفحه‌ی گوشی.
          </p>

          {mode === "ios-manual" && showIosSteps && (
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
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {mode === "prompt" ? (
              <Button size="sm" icon={<Download size={14} />} onClick={handleInstall}>
                نصب
              </Button>
            ) : (
              <Button
                size="sm"
                icon={<Share size={14} />}
                onClick={() => setShowIosSteps((v) => !v)}
                aria-expanded={showIosSteps}
              >
                {showIosSteps ? "بستن راهنما" : "چطور نصب کنم؟"}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={dismiss}>
              بعداً
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="بستن پیشنهاد نصب"
          className="shrink-0 rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X size={15} aria-hidden />
        </button>
      </div>
    </div>
  );
}
