"use client";

import { useEffect, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";
import { Button } from "@/src/shared/ui";
import { isIOS, isInAppBrowser } from "@/lib/utils/platform";
import {
  INSTALL_DISMISS_KEY, isDismissActive, isStandalone,
  iosInstallSteps, resolveInstallMode, type InstallMode,
} from "@/lib/pwa";
import { BRAND_NAME } from "@/lib/brand";
import { toFaDigits } from "@/lib/utils/format";

/**
 * پیشنهاد نصب برنامه روی گوشی.
 *
 * ⚠️ رویداد `beforeinstallprompt` استاندارد نیست و فقط در
 * کروم/اج وجود دارد. سافاری iOS هیچ راه برنامه‌نویسی‌شده‌ای برای
 * نصب ندارد — تنها کار ممکن نشان‌دادن راهنمای دستی است.
 *
 * برای همین دو مسیر جدا داریم و *هیچ‌کدام* دکمه‌ای نشان نمی‌دهند
 * که کلیک شود و کار نکند. این درسی است که از دکمه‌ی ورود صوتی
 * گرفتیم: دکمه‌ای که وعده بدهد و عمل نکند، بدتر از نبودنش است.
 */

/** رویداد غیراستاندارد کروم. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<InstallMode>("unavailable");
  const [open, setOpen] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    if (isDismissActive(window.localStorage.getItem(INSTALL_DISMISS_KEY))) return;

    const decide = (prompt: BeforeInstallPromptEvent | null) => {
      const next = resolveInstallMode({
        standalone: isStandalone(),
        hasPrompt: prompt !== null,
        ios: isIOS(),
        inAppBrowser: isInAppBrowser(),
      });
      setMode(next);
      // فقط دو حالتی که واقعاً کاری از دست کاربر برمی‌آید.
      setOpen(next === "prompt" || next === "ios-manual");
    };

    function onBeforeInstall(event: Event) {
      /*
        جلوی نوار پیش‌فرض کروم را می‌گیریم تا خودمان در زمان مناسب
        و با متن فارسی نشان دهیم.
      */
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      setDeferred(promptEvent);
      decide(promptEvent);
    }

    function onInstalled() {
      // پس از نصب موفق دیگر هرگز نپرس.
      setOpen(false);
      window.localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    /*
      iOS هرگز beforeinstallprompt نمی‌فرستد، پس با تأخیر کوتاه
      خودمان تصمیم می‌گیریم. تأخیر عمدی است: نشان‌دادن پیشنهاد نصب
      در ثانیه‌ی اول ورود، مزاحمت است.
    */
    const timer = window.setTimeout(() => decide(null), 4000);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    setOpen(false);
    window.localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "accepted") setOpen(false);
    else dismiss();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="install-title"
      /*
        بالای نوار پایین موبایل (۶۸px) می‌نشیند تا رویش نیفتد.
        روی دسکتاپ نوار پایین وجود ندارد، پس فاصله کمتر است.
      */
      className="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[1400] mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-lg lg:bottom-4 lg:right-4 lg:left-auto lg:mx-0"
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
              <Button size="sm" icon={<Download size={14} />} onClick={install}>
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
