"use client";

import { toFaDigits, toEnDigits, formatToman, toJalali, formatNumber } from "@/lib/utils/format";
import { useOrgPrefs } from "@/lib/hooks/useOrgPrefs";
import { cn } from "@/lib/utils/cn";

export { toFaDigits as toPersianDigits, toEnDigits as toEnglishDigits, formatNumber };

/**
 * قالب‌بندی مبلغ **بدون** ترجیح سازمان.
 *
 * 🔴 این یک تابع خالص است، نه کامپوننت — پس نمی‌تواند hook صدا
 * بزند. اسکریپت مهاجرت خودکار یک بار اشتباهاً hook را اینجا
 * گذاشت و آن نقض قواعد hook بود: `formatMoney` از داخل شرط و
 * حلقه هم صدا زده می‌شود.
 *
 * ⚠️ برای احترام به واحد سازمان از کامپوننت `<Money>` یا از
 * `useOrgPrefs().money()` استفاده کنید. این تابع فقط برای جاهایی
 * است که hook در دسترس نیست (مثلاً تولید CSV).
 */
export function formatMoney(amount: number | null | undefined, options?: { withLabel?: boolean }) {
  return formatToman(amount, options?.withLabel ?? true);
}

export function formatJalali(date: string | Date | null | undefined, withTime = false) {
  return toJalali(date, withTime);
}

export function Money({ value, tone = "neutral", className }: { value: number | null | undefined; tone?: "neutral" | "positive" | "negative" | "debt" | "credit"; className?: string }) {
  /*
    ⚠️ hook اینجا درست است چون `Money` کامپوننت است. همین باعث
    می‌شود هر جای برنامه که از `<Money>` استفاده می‌کند خودکار
    واحد سازمان را بگیرد — بدون تغییر در آن فایل‌ها.
  */
  const { money } = useOrgPrefs();
  const toneClass = {
    neutral: "text-foreground",
    positive: "text-finance-profit",
    negative: "text-finance-loss",
    debt: "text-finance-debt",
    credit: "text-finance-credit",
  }[tone];
  return <span className={cn("font-semibold tabular-nums", toneClass, className)}>{money(value)}</span>;
}

export function PersianDate({ value, withTime = false, className }: { value: string | Date | null | undefined; withTime?: boolean; className?: string }) {
  return <time className={cn("tabular-nums", className)}>{formatJalali(value, withTime)}</time>;
}
