"use client";

import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
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

  const remove = useCallback((id: string) => setItems((prev) => prev.filter((item) => item.id !== id)), []);

  const toast = useCallback((item: Omit<ToastItem, "id">) => {
    const id = createToastId();
    setItems((prev) => [...prev, { ...item, id }].slice(-4));
    window.setTimeout(() => remove(id), item.tone === "error" ? 7000 : 4000);
  }, [remove]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed left-4 top-4 z-[150] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2" dir="rtl">
        {items.map((item) => <ToastCard key={item.id} item={item} onClose={() => remove(item.id)} />)}
      </div>
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
  const toneClass = {
    success: "border-success/20 bg-success-soft text-success",
    error: "border-destructive/20 bg-rose-50 text-destructive dark:bg-rose-950/30",
    warning: "border-warning/25 bg-warning-soft text-warning",
    info: "border-info/20 bg-info-soft text-info",
  }[item.tone];
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border p-3 shadow-lg backdrop-blur", toneClass)}>
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-extrabold">{item.title}</div>
        {item.description && <div className="mt-0.5 text-xs leading-5 opacity-85">{item.description}</div>}
      </div>
      <button onClick={onClose} className="rounded-lg p-1 opacity-70 hover:bg-white/40" aria-label="بستن پیام"><X size={15} /></button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
