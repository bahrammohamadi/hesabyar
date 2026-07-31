"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Info, X } from "lucide-react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

export type ConfirmTone = "default" | "danger";

export interface ConfirmOptions {
  title: string;
  description?: string;
  tone?: ConfirmTone;
  confirmLabel?: string;
  cancelLabel?: string;
}

type ConfirmState = ConfirmOptions & { open: boolean };
type Resolver = (value: boolean) => void;

type ConfirmApi = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmApi | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const [mounted, setMounted] = useState(false);
  const resolverRef = useRef<Resolver | null>(null);

  const close = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState(null);
  }, []);

  const confirm = useCallback<ConfirmApi>((options) => {
    setState({ ...options, open: true });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  useEffect(() => setMounted(true), []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {mounted && createPortal(<ConfirmDialog state={state} onCancel={() => close(false)} onConfirm={() => close(true)} />, document.body)}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ state, onCancel, onConfirm }: { state: ConfirmState | null; onCancel: () => void; onConfirm: () => void }) {
  if (!state?.open) return null;
  const tone = state.tone ?? "default";
  const isDanger = tone === "danger";
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" style={{ zIndex: "var(--z-confirm)" }} dir="rtl" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <div className={isDanger ? "flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-destructive" : "flex h-11 w-11 items-center justify-center rounded-2xl bg-info-soft text-info"}>
              {isDanger ? <AlertTriangle size={22} /> : <Info size={22} />}
            </div>
            <div>
              <h2 id="confirm-title" className="text-base font-extrabold text-slate-800 dark:text-slate-100">{state.title}</h2>
              {state.description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{state.description}</p>}
            </div>
          </div>
          <IconButton onClick={onCancel} aria-label="بستن"><X size={18} /></IconButton>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4">
          <Button variant="secondary" onClick={onCancel}>{state.cancelLabel ?? "انصراف"}</Button>
          <Button variant={isDanger ? "danger" : "primary"} onClick={onConfirm}>{state.confirmLabel ?? "تأیید"}</Button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm must be used inside ConfirmProvider");
  return context;
}
