"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ToastTone = "success" | "error" | "warning" | "info";
type ToastItem = { id: string; title: string; description?: string; tone: ToastTone };

type ToastApi = {
  toast: (item: Omit<ToastItem, "id">) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

function createToastId() {
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  const remove = useCallback((id: string) => setItems((prev) => prev.filter((item) => item.id !== id)), []);

  const toast = useCallback((item: Omit<ToastItem, "id">) => {
    const id = createToastId();
    setItems((prev) => [...prev, { ...item, id }].slice(-4));
    window.setTimeout(() => remove(id), item.tone === "error" ? 7000 : 4000);
  }, [remove]);

  useEffect(() => setMounted(true), []);

  const value = useMemo(() => ({ toast }), [toast]);

  /*
    🔴 سه ایراد دسترس‌پذیری که axe روی سایت زنده گرفت و هر سه سراسری
    بودند (هر پیامی در هر صفحه‌ای):

     ۱ `region` — محتوای پیام بیرون هر landmark بود. صفحه‌خوان آن را
        «محتوای بی‌صاحب» گزارش می‌کرد.
     ۲ اعلام‌نشدن — بدون role/aria-live، پیام «تیکت ثبت شد» فقط
        *دیده* می‌شد. کاربر نابینا هیچ بازخوردی از موفقیت عملیات
        نمی‌گرفت.
     ۳ `color-contrast` روی توضیح (پایین‌تر).

    aria-live روی خودِ ظرف است نه کارت‌ها: ناحیه باید *پیش از*
    افزوده‌شدن محتوا در DOM باشد، وگرنه مرورگر تغییر را اعلام نمی‌کند.
  */
  const toastLayer = (
    <div
      className="fixed left-4 top-4 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2"
      style={{ zIndex: "var(--z-toast)" }}
      dir="rtl"
      role="region"
      aria-label="پیام‌های سیستم"
      aria-live="polite"
      aria-atomic="false"
    >
      {items.map((item) => <ToastCard key={item.id} item={item} onClose={() => remove(item.id)} />)}
    </div>
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted && createPortal(toastLayer, document.body)}
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const icon = {
    success: <CheckCircle2 size={18} />,
    error: <XCircle size={18} />,
    warning: <TriangleAlert size={18} />,
    info: <Info size={18} />,
  }[item.tone];
  /*
    🔴 توکن *متن روی پس‌زمینه‌ی ملایم* استفاده می‌شود، نه توکن پرکننده.

    `text-success` رنگِ پُرکردن است (#10b77f) و روی `bg-success-soft`
    (#edfdf5) نسبت کنتراست ۲٫۴۶:۱ می‌داد — کمتر از نصف آستانه‌ی ۴٫۵:۱.
    `--success-on-soft` دقیقاً برای همین حالت تعریف شده بود ولی اینجا
    استفاده نشده بود. همین اشتباه برای warning هم بود.
    (اندازه‌گیری axe روی سایت زنده، پیش از اصلاح.)
  */
  const toneClass = {
    success: "border-success/20 bg-success-soft text-success-onSoft",
    error: "border-destructive/20 bg-destructive/10 text-destructive-text",
    warning: "border-warning/25 bg-warning-soft text-warning-onSoft",
    info: "border-info/20 bg-info-soft text-info-text",
  }[item.tone];
  return (
    <div
      className={cn("flex items-start gap-3 rounded-2xl border p-3 shadow-lg backdrop-blur", toneClass)}
      /*
        خطا باید فوراً اعلام شود (assertive)؛ موفقیت می‌تواند صبر کند
        تا کاربر جمله‌ی جاری را تمام کند.
      */
      role={item.tone === "error" ? "alert" : "status"}
    >
      <div className="mt-0.5" aria-hidden>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-extrabold">{item.title}</div>
        {/*
          ⚠️ opacity استفاده نمی‌شود.
          توکن‌های رنگ متن دقیقاً روی آستانه‌ی ۴.۵:۱ کالیبره شده‌اند؛
          هر شفافیتی آن‌ها را زیر آستانه می‌برد.
          (axe: color-contrast/serious روی همین `opacity-85`. همان
          اشتباهی که قبلاً در شمارنده‌ی دوره‌ی تست و در زمان اعلان‌ها
          هم تکرار شده بود.)
        */}
        {item.description && <div className="mt-0.5 text-xs leading-5">{item.description}</div>}
      </div>
      <button onClick={onClose} className="rounded-lg p-1 hover:bg-white/40" aria-label="بستن پیام"><X size={15} aria-hidden /></button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
