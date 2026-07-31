"use client";

import { toFaDigits, toEnDigits, formatToman, toJalali, formatNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export { toFaDigits as toPersianDigits, toEnDigits as toEnglishDigits, formatNumber };

export function formatMoney(amount: number | null | undefined, options?: { withLabel?: boolean }) {
  return formatToman(amount, options?.withLabel ?? true);
}

export function formatJalali(date: string | Date | null | undefined, withTime = false) {
  return toJalali(date, withTime);
}

export function Money({ value, tone = "neutral", className }: { value: number | null | undefined; tone?: "neutral" | "positive" | "negative" | "debt" | "credit"; className?: string }) {
  const toneClass = {
    neutral: "text-foreground",
    positive: "text-finance-profit",
    negative: "text-finance-loss",
    debt: "text-finance-debt",
    credit: "text-finance-credit",
  }[tone];
  return <span className={cn("font-semibold tabular-nums", toneClass, className)}>{formatMoney(value)}</span>;
}

export function PersianDate({ value, withTime = false, className }: { value: string | Date | null | undefined; withTime?: boolean; className?: string }) {
  return <time className={cn("tabular-nums", className)}>{formatJalali(value, withTime)}</time>;
}
