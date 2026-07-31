"use client";

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary/25",
  secondary: "border border-border bg-card text-foreground hover:bg-muted focus:ring-primary/20",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive/25",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground focus:ring-primary/20 dark:text-muted-foreground",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "min-h-9 rounded-xl px-3 py-1.5 text-xs",
  md: "min-h-11 rounded-xl px-4 py-2.5 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = "primary", size = "md", loading, icon, children, className, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-bold transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
        variantClass[variant],
        sizeClass[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" size={16} /> : icon}
      {children}
    </button>
  );
}
