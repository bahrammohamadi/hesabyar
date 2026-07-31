"use client";

import { Minus, Plus } from "lucide-react";
import { toEnDigits, toFaDigits } from "@/lib/utils/format";

export function QuantityStepper({ value, onChange, min = 1, className = "" }: { value: number | string; onChange: (value: number) => void; min?: number; className?: string }) {
  const numeric = Math.max(min, Number(toEnDigits(String(value))) || min);
  function set(next: number) {
    onChange(Math.max(min, next));
  }
  return (
    <div className={`flex h-10 min-h-10 items-center overflow-hidden rounded-xl border border-border bg-card ${className}`}>
      <button type="button" onClick={() => set(numeric - 1)} className="flex h-10 min-w-10 items-center justify-center text-muted-foreground hover:bg-muted" aria-label="کم کردن تعداد"><Minus size={16} /></button>
      <input className="h-10 min-w-12 flex-1 border-0 bg-transparent px-1 text-center text-sm font-bold outline-none" inputMode="numeric" value={toFaDigits(String(value ?? numeric))} onChange={(e) => set(Number(toEnDigits(e.target.value)) || min)} />
      <button type="button" onClick={() => set(numeric + 1)} className="flex h-10 min-w-10 items-center justify-center text-muted-foreground hover:bg-muted" aria-label="زیاد کردن تعداد"><Plus size={16} /></button>
    </div>
  );
}
