"use client";

import { useEffect, useRef } from "react";

/**
 * ثبت یک میانبر صفحه‌کلید در سطح کل برنامه.
 *
 * چرا هوک مشترک و نه useEffect محلی در هر صفحه؟
 *   میانبرها رفتار سراسری‌اند و منطق تکراری دارند: نادیده‌گرفتن هنگام
 *   تایپ، preventDefault، و پاک‌سازی listener. تکرار این‌ها در هر صفحه
 *   یعنی احتمال جاافتادن یکی از آن‌ها. اینجا یک‌بار درست نوشته می‌شود.
 *
 * نکته‌ی مهم درباره‌ی handler:
 *   ارجاع به handler در یک ref نگه داشته می‌شود و افکت فقط یک‌بار اجرا
 *   می‌شود. اگر handler مستقیم در آرایه‌ی وابستگی می‌آمد، هر رندرِ والد
 *   (که تابع تازه‌ای می‌سازد) باعث حذف و ثبت دوباره‌ی listener می‌شد.
 *
 * @param key       نام کلید مطابق KeyboardEvent.key — مثلاً "F2" یا "k"
 * @param handler   تابعی که هنگام فشردن کلید اجرا می‌شود
 * @param options   تنظیمات اختیاری
 */
export function useGlobalShortcut(
  key: string,
  handler: () => void,
  options?: {
    /** آیا Ctrl (یا Cmd روی مک) هم لازم است؟ پیش‌فرض: خیر */
    ctrlOrMeta?: boolean;
    /** آیا Shift لازم است؟ پیش‌فرض: خیر */
    shift?: boolean;
    /**
     * وقتی فوکوس داخل input/textarea/select یا محتوای قابل‌ویرایش است،
     * میانبر نادیده گرفته شود. پیش‌فرض: بله.
     *
     * برای میانبرهایی مثل Ctrl+K که باید همه‌جا کار کنند، false بدهید.
     */
    skipWhileTyping?: boolean;
    /** غیرفعال کردن موقت میانبر بدون حذف فراخوانی هوک. */
    enabled?: boolean;
  }
) {
  const {
    ctrlOrMeta = false,
    shift = false,
    skipWhileTyping = true,
    enabled = true,
  } = options ?? {};

  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    function isTypingTarget(target: EventTarget | null) {
      const el = (target as HTMLElement | null) ?? (document.activeElement as HTMLElement | null);
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    }

    function onKeyDown(event: KeyboardEvent) {
      // مقایسه‌ی حروف بدون حساسیت به بزرگی/کوچکی؛ کلیدهای تابعی مثل F2
      // همیشه با همان شکل استاندارد می‌آیند.
      if (event.key.toLowerCase() !== key.toLowerCase()) return;

      const hasCtrlOrMeta = event.ctrlKey || event.metaKey;
      if (ctrlOrMeta !== hasCtrlOrMeta) return;
      if (shift !== event.shiftKey) return;

      if (skipWhileTyping && isTypingTarget(event.target)) return;

      event.preventDefault();
      handlerRef.current();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, ctrlOrMeta, shift, skipWhileTyping, enabled]);
}
