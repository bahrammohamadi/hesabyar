"use client";

import { useEffect } from "react";

/**
 * ثبت سرویس‌ورکر.
 *
 * 🔴 بدون این، کروم دکمه‌ی «نصب برنامه» را نشان نمی‌دهد. مانیفست و
 * آیکون‌ها از قبل آماده بودند ولی هیچ سرویس‌ورکری ثبت نمی‌شد، پس
 * اپ با اینکه «PWA به نظر می‌رسید» عملاً قابل نصب نبود.
 *
 * ⚠️ عمداً هیچ چیزی رندر نمی‌کند — فقط یک اثر جانبی است.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    /*
      ⚠️ در حالت توسعه ثبت نمی‌شود.

      سرویس‌ورکر دارایی‌ها را کش می‌کند و در dev باعث می‌شود تغییرات
      کد دیده نشوند — توسعه‌دهنده ساعت‌ها دنبال باگی می‌گردد که از
      قبل رفعش کرده.
    */
    if (process.env.NODE_ENV !== "production") return;

    /*
      تا بعد از load صبر می‌کنیم.
      ثبت زودهنگام با بارگذاری اولیه‌ی صفحه رقابت می‌کند و روی
      اینترنت ضعیف، نمایش اولین محتوا را کند می‌کند.
    */
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /*
          شکست ثبت نباید چیزی را بشکند. روی مرورگرهای قدیمی یا در
          حالت ناشناس ممکن است ممنوع باشد؛ برنامه بدون آن هم کاملاً
          کار می‌کند و فقط قابل نصب نیست.
        */
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
