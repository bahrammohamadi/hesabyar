"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function IconButton({ children, className, "aria-label": ariaLabel, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? "دکمه آیکونی"}
      className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20", className)}
      {...props}
    >
      {children}
    </button>
  );
}
