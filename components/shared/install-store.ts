"use client";

/**
 * فروشگاه‌ی تک‌نمونه‌ی وضعیت نصب اپ.
 *
 * 🔴 چرا یک singleton و نه useEffect داخل خود کامپوننت؟
 *   حالا **دو** مصرف‌کننده داریم: بنر داشبورد و دکمه‌ی دائمی کنار
 *   زنگوله. رویداد `beforeinstallprompt` در کل عمر صفحه **یک‌بار**
 *   شلیک می‌شود؛ اگر هر کامپوننت جدا گوش بدهد، هرکدام که دیرتر mount
 *   شود آن را از دست می‌دهد و دکمه‌اش بی‌اثر می‌ماند — دقیقاً همان
 *   «دکمه‌ای که وعده می‌دهد و عمل نمی‌کند» که قبلاً از آن درس گرفتیم.
 *
 *   با ثبت listener در لحظه‌ی import ماژول، رویداد یک‌جا گرفته و
 *   نگه داشته می‌شود و هر تعداد مصرف‌کننده می‌توانند از آن استفاده کنند.
 */

import { useEffect, useState } from "react";
import { isIOS, isInAppBrowser } from "@/lib/utils/platform";
import { isStandalone, resolveInstallMode, type InstallMode } from "@/lib/pwa";

/** رویداد غیراستاندارد کروم/اج. */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // جلوی نوار پیش‌فرض کروم را می‌گیریم تا خودمان در زمان مناسب نشان دهیم.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    emit();
  });
}

/** محاسبه‌ی حالت فعلی نصب از روی وضعیت مرورگر. */
function currentMode(): InstallMode {
  if (installed) return "unavailable";
  return resolveInstallMode({
    standalone: isStandalone(),
    hasPrompt: deferredPrompt !== null,
    ios: isIOS(),
    inAppBrowser: isInAppBrowser(),
  });
}

/**
 * حالت نصب + تابع اجرای نصب.
 *
 * `ready` تا پیش از mount شدن روی کلاینت false است تا رندر سرور و
 * کلاینت یکی بمانند (hydration mismatch).
 */
export function useInstallState() {
  const [mode, setMode] = useState<InstallMode>("unavailable");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setMode(currentMode());
    sync();
    setReady(true);
    listeners.add(sync);

    /*
      کروم گاهی رویداد را چند صد میلی‌ثانیه بعد از بارگذاری می‌فرستد.
      یک بازبینی تأخیری، حالت را از "ios-manual"/"unavailable" به
      "prompt" ارتقا می‌دهد بدون اینکه منتظر تعامل کاربر بمانیم.
    */
    const timer = window.setTimeout(sync, 3000);
    return () => {
      listeners.delete(sync);
      window.clearTimeout(timer);
    };
  }, []);

  /**
   * نمایش دیالوگ نصب مرورگر.
   *
   * خروجی می‌گوید آیا کاربر پذیرفت — تماس‌گیرنده بر اساس آن تصمیم
   * می‌گیرد بنر را ببندد یا «بعداً» ثبت کند.
   */
  async function install(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!deferredPrompt) return "unavailable";
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    /*
      رویداد یک‌بارمصرف است: پس از prompt() دیگر قابل استفاده‌ی مجدد
      نیست و نگه‌داشتنش باعث می‌شود دکمه ظاهراً فعال بماند ولی کار نکند.
    */
    deferredPrompt = null;
    emit();
    return choice.outcome;
  }

  return { mode, ready, install };
}
