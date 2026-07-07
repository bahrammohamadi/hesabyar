"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { HelpTip } from "./HelpTip";
import { toEnglishDigits, toPersianDigits } from "@/src/shared/format";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("input", className)} {...props} />;
});

export function NumberInput({ value, onValueChange, className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value?: number | null; onValueChange?: (value: number | null) => void }) {
  const display = value === null || value === undefined ? "" : toPersianDigits(Math.trunc(value).toLocaleString("en-US"));
  return (
    <input
      inputMode="numeric"
      dir="ltr"
      className={cn("input text-left tabular-nums", className)}
      value={display}
      onChange={(event) => {
        const normalized = toEnglishDigits(event.target.value).replace(/,/g, "").replace(/[^0-9-]/g, "");
        onValueChange?.(normalized === "" || normalized === "-" ? null : Number(normalized));
      }}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("input", className)} {...props}>{children}</select>;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("input min-h-28 resize-y", className)} {...props} />;
}

export function Field({ label, required, error, hint, children, className }: { label: string; required?: boolean; error?: string | null; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("block space-y-1.5", className)}>
      <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
        <span>{label} {required && <span className="text-destructive">*</span>}</span>
        <HelpTip text={hint} />
      </span>
      {children}
      {error ? <span className="block text-xs leading-5 text-destructive">{error}</span> : hint ? <span className="block text-xs leading-5 text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
