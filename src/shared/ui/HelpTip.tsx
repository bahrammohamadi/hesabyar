"use client";

import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function HelpTip({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;
  return (
    <span className={cn("group relative inline-flex align-middle", className)}>
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary transition hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/20"
        aria-label="راهنمای این بخش"
      >
        <HelpCircle size={13} />
      </button>
      <span className="pointer-events-none absolute right-0 top-7 z-[1600] hidden w-64 rounded-2xl border border-slate-200 bg-white p-3 text-right text-xs leading-6 text-slate-600 shadow-2xl group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}
