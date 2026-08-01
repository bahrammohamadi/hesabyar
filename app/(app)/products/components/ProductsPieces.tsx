"use client";

/**
 * قطعات بصری مدیریت موجودی محصولات — مطابق مرجع طراحی «مدیریت موجودی محصولات».
 *
 * ⚠️ فقط ظرف بصری. هیچ کوئری، RPC یا محاسبه‌ی موجودی اینجا انجام نمی‌شود؛
 * مقادیر از صفحه‌ی مصرف‌کننده pass می‌شوند. مسیر ثبت گردش انبار
 * (fn_add_stock_movement) اصلاً در این فایل لمس نشده است.
 */

import type { ReactNode } from "react";
import { Badge, Card } from "@/src/shared/ui";

/* ------------------------------------------------------------------ */
/* کارت KPI — مطابق مرجع: نوار رنگی کناری + عدد بزرگ + واحد            */
/* ------------------------------------------------------------------ */

const KPI_ACCENT = {
  primary: { bar: "bg-primary", value: "text-foreground" },
  destructive: { bar: "bg-destructive", value: "text-destructive" },
  info: { bar: "bg-info", value: "text-info" },
  success: { bar: "bg-success", value: "text-foreground" },
} as const;

export type ProductKpiAccent = keyof typeof KPI_ACCENT;

export function ProductKpiCard({
  label,
  value,
  unit,
  chip,
  chipTone = "neutral",
  accent = "primary",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  chip?: string;
  chipTone?: "neutral" | "success" | "warning" | "danger" | "info" | "primary";
  accent?: ProductKpiAccent;
}) {
  const a = KPI_ACCENT[accent];
  return (
    <Card className="relative h-full overflow-hidden p-4 sm:p-5">
      {/* نوار رنگی سمت راست — مطابق مرجع (RTL) */}
      <span className={`absolute inset-y-0 right-0 w-1.5 ${a.bar}`} aria-hidden />
      <div className="flex items-start justify-between gap-2 pr-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {chip && <Badge tone={chipTone}>{chip}</Badge>}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5 pr-2">
        <span className={`text-2xl font-black tabular-nums ${a.value}`}>{value}</span>
        {unit && <span className="text-2xs text-muted-foreground">{unit}</span>}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* وضعیت موجودی — سه حالت مرجع، نگاشت‌شده به variantهای Badge          */
/*   اتمام موجودی → danger   |   موجودی کم → warning   |   موجود → success */
/* ------------------------------------------------------------------ */

export type StockState = "out" | "low" | "ok";

export function stockStateOf(totalStock: number, threshold: number): StockState {
  if (totalStock <= 0) return "out";
  if (totalStock <= threshold) return "low";
  return "ok";
}

const STOCK_LABEL: Record<StockState, string> = {
  out: "اتمام موجودی",
  low: "موجودی کم",
  ok: "موجود",
};

const STOCK_TONE: Record<StockState, "danger" | "warning" | "success"> = {
  out: "danger",
  low: "warning",
  ok: "success",
};

export function StockStatusBadge({ state }: { state: StockState }) {
  return <Badge tone={STOCK_TONE[state]}>{STOCK_LABEL[state]}</Badge>;
}

/** رنگ عدد موجودی، هم‌راستا با وضعیت */
export function stockQtyClass(state: StockState) {
  // این مقدار به‌صورت عدد در جدول رندر می‌شود، پس باید متن‌ایمن باشد:
  // text-destructive روی سفید ۳.۷۸ و text-warning ۲.۱ می‌داد.
  return state === "out"
    ? "text-destructive-text"
    : state === "low"
      ? "text-warning-onSoft"
      : "text-foreground";
}
