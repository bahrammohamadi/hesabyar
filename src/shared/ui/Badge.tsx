"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-success-soft text-success-onSoft border-success/25",
  warning: "bg-warning-soft text-warning-onSoft border-warning/30",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  info: "bg-info-soft text-info-onSoft border-info/25",
  primary: "bg-primary/10 text-primary border-primary/20",
};

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-extrabold", toneClass[tone], className)}>{children}</span>;
}

const documentStatusMap = {
  draft: { label: "پیش‌نویس", tone: "neutral" },
  confirmed: { label: "تأییدشده", tone: "info" },
  paid: { label: "پرداخت‌شده", tone: "success" },
  settled: { label: "تسویه‌شده", tone: "success" },
  reversed: { label: "برگشت‌خورده", tone: "danger" },
  cancelled: { label: "لغوشده", tone: "danger" },
  returned: { label: "مرجوعی", tone: "warning" },
} satisfies Record<string, { label: string; tone: BadgeTone }>;

const paymentStatusMap = {
  unpaid: { label: "پرداخت‌نشده", tone: "danger" },
  partial: { label: "پرداخت جزئی", tone: "warning" },
  paid: { label: "پرداخت‌شده", tone: "success" },
} satisfies Record<string, { label: string; tone: BadgeTone }>;

export function StatusPill({ status, kind = "document", className }: { status: string | null | undefined; kind?: "document" | "payment"; className?: string }) {
  const key = status ?? "";
  const map = kind === "payment" ? paymentStatusMap : documentStatusMap;
  const item = map[key as keyof typeof map] ?? { label: status || "نامشخص", tone: "neutral" as BadgeTone };
  return <Badge tone={item.tone} className={className}>{item.label}</Badge>;
}
