"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

const MENU_WIDTH = 208;
const GAP = 8;
/** حداقل ارتفاعی که منو باید داشته باشد تا نمایشش معنا داشته باشد. */
const MIN_HEIGHT = 120;

type MenuStyle = {
  top: number;
  left: number;
  width: number;
  maxHeight: number | undefined;
  /** برای انیمیشن: منو بالای دکمه باز شده یا پایین آن. */
  placement: "bottom" | "top";
};

/**
 * منوی شناور که کنار یک دکمه‌ی لنگر باز می‌شود.
 *
 * مسئله‌ای که حل می‌کند:
 *   محاسبه‌ی قبلی فقط `Math.min(window.innerHeight - gap, rect.bottom + gap)`
 *   بود. این تنها جلوی خروج «نقطه‌ی شروع» منو را می‌گرفت و ارتفاع واقعی
 *   محتوا را نمی‌دانست. اندازه‌گیری شد: روی آخرین ردیف فهرست مشتریان،
 *   منوی ۴۹۴ پیکسلی ۷۰ پیکسل از پایین صفحه بیرون می‌زد و ۲ آیتم از ۱۰
 *   بدون اسکرول قابل کلیک نبود.
 *
 * راهبرد جای‌گذاری:
 *   ۱. اگر زیر دکمه جا هست → همان‌جا (رفتار پیش‌فرض و آشنا).
 *   ۲. اگر نیست ولی بالای دکمه جا هست → بالای دکمه باز شود.
 *   ۳. اگر هیچ‌کدام کافی نیست → سمتی که فضای بیشتری دارد انتخاب و
 *      `max-height` + اسکرول داخلی روی خود منو گذاشته می‌شود، تا کاربر
 *      به‌جای اسکرول کل صفحه، داخل منو اسکرول کند.
 */
export function PortalMenu({
  anchorRef,
  open,
  onClose,
  children,
}: {
  anchorRef: RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<MenuStyle>({
    top: 0,
    left: 0,
    width: MENU_WIDTH,
    maxHeight: undefined,
    placement: "bottom",
  });
  /*
    تا وقتی اندازه‌گیری انجام نشده منو نامرئی است.
    بدون این، کاربر یک «پرش» می‌بیند: منو اول پایین رندر می‌شود و بعد
    به بالا می‌پرد. visibility (نه display) استفاده شده چون عنصر باید
    در layout حضور داشته باشد تا بشود ارتفاعش را خواند.
  */
  const [measured, setMeasured] = useState(false);

  useLayoutEffect(() => setMounted(true), []);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const rect = anchor.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    // ارتفاع طبیعی محتوا. scrollHeight خوانده می‌شود نه offsetHeight،
    // چون اگر از قبل max-height خورده باشد، offsetHeight مقدار بریده را می‌دهد
    // و محاسبه در رندرهای بعدی به‌تدریج کوچک‌تر می‌شود.
    const naturalH = menu.scrollHeight;

    const spaceBelow = viewportH - rect.bottom - GAP * 2;
    const spaceAbove = rect.top - GAP * 2;

    let placement: "bottom" | "top";
    let maxHeight: number | undefined;
    let top: number;

    if (naturalH <= spaceBelow) {
      // حالت عادی: زیر دکمه جا می‌شود
      placement = "bottom";
      top = rect.bottom + GAP;
    } else if (naturalH <= spaceAbove) {
      // زیرش جا نیست ولی بالایش هست
      placement = "top";
      top = rect.top - naturalH - GAP;
    } else {
      /*
        هیچ سمتی به‌تنهایی کافی نیست.

        اینجا محدود کردن منو به یکی از دو طرف، فضای طرف دیگر را هدر می‌دهد:
        با دکمه‌ای در وسط یک viewport ۶۰۰ پیکسلی، هر سمت فقط ۲۶۶ پیکسل
        دارد و منوی ۴۹۴ پیکسلی به نصف بریده می‌شود — یعنی نیمی از آیتم‌ها
        پشت اسکرول داخلی پنهان می‌مانند.

        به‌جای آن، کل ارتفاع viewport استفاده می‌شود و منو تا جای ممکن
        کشیده می‌شود؛ فقط اگر باز هم جا نشد اسکرول داخلی می‌گیرد.
      */
      const available = viewportH - GAP * 2;
      maxHeight = Math.max(MIN_HEIGHT, Math.min(naturalH, available));
      // نزدیک‌ترین جای ممکن به دکمه، ولی داخل viewport
      const preferred = rect.bottom + GAP;
      top = Math.max(GAP, Math.min(preferred, viewportH - maxHeight - GAP));
      placement = top < rect.top ? "top" : "bottom";
    }

    const height = maxHeight ?? naturalH;
    // مهار نهایی: در هیچ حالتی از بالا یا پایین بیرون نزند.
    top = Math.max(GAP, Math.min(top, viewportH - height - GAP));

    /*
      محور افقی — این بخش از قبل درست بود و فقط تأیید شد:
      منو با لبه‌ی راست دکمه هم‌تراز می‌شود (چون چیدمان RTL است)، بعد
      در بازه‌ی [GAP, viewportW - width - GAP] محدود می‌شود تا از هیچ
      سمتی بیرون نزند. برای viewportهای باریک‌تر از عرض منو هم
      Math.max بیرونی تضمین می‌کند left منفی نشود.
    */
    const width = Math.min(MENU_WIDTH, viewportW - GAP * 2);
    const left = Math.max(GAP, Math.min(rect.right - width, viewportW - width - GAP));

    setStyle({ top, left, width, maxHeight, placement });
    setMeasured(true);
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) {
      setMeasured(false);
      return;
    }
    // اولین اندازه‌گیری بعد از mount شدن محتوا — پیش از این، ارتفاع صفر است.
    reposition();

    /*
      اگر محتوای منو بعداً عوض شود (مثلاً آیتمی بر اساس مجوز اضافه شود)
      ارتفاع تغییر می‌کند و جای‌گذاری باید به‌روز شود.
    */
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(reposition) : null;
    if (observer && menuRef.current) observer.observe(menuRef.current);

    window.addEventListener("resize", reposition);
    // اسکرول در فاز capture گرفته می‌شود تا اسکرول کانتینرهای داخلی هم پوشش داده شود.
    window.addEventListener("scroll", reposition, true);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, reposition]);

  /*
    بستن با Escape — انتظار استاندارد از هر منوی شناور.

    capture + stopPropagation به همان دلیل Modal: منو بالاترین لایه
    است و نباید بگذارد PanelHost هم‌زمان پنل زیرین را ببندد.
  */
  useLayoutEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <>
      <button className="fixed inset-0 z-[1250] bg-transparent" onClick={onClose} aria-label="بستن منو" />
      <div
        ref={menuRef}
        role="menu"
        data-placement={style.placement}
        className="fixed z-[1260] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-2 shadow-2xl animate-pop-in"
        style={{
          top: style.top,
          left: style.left,
          width: style.width,
          maxHeight: style.maxHeight,
          visibility: measured ? "visible" : "hidden",
        }}
        dir="rtl"
      >
        {children}
      </div>
    </>,
    document.body
  );
}
