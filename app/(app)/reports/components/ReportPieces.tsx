"use client";

/**
 * قطعات بصری گزارشات پیشرفته — مطابق مرجع طراحی «گزارشات و تحلیل بازار».
 *
 * ⚠️ فقط ظرف بصری. هیچ کوئری، RPC یا محاسبه‌ای اینجا انجام نمی‌شود.
 * منابع داده (v_daily_sales / v_product_profitability و RPCها) اصلاً در این
 * فایل لمس نشده‌اند؛ مقادیر از صفحه‌ی مصرف‌کننده pass می‌شوند.
 */

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge, Card } from "@/src/shared/ui";
import { DatePicker } from "@/components/shared/date-picker";

/* ------------------------------------------------------------------ */
/* رنگ نمودارها — از توکن‌های معنایی پروژه خوانده می‌شود                */
/* Recharts مقدار رنگ واقعی می‌خواهد، پس از hsl(var(--token)) استفاده   */
/* می‌کنیم تا دارک‌مود و تعویض تم همچنان کار کند.                       */
/* ------------------------------------------------------------------ */

export const CHART_TOKENS = {
  primary: "hsl(var(--primary))",
  success: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--destructive))",
  info: "hsl(var(--info))",
  muted: "hsl(var(--muted-foreground))",
  grid: "hsl(var(--border))",
  axis: "hsl(var(--muted-foreground))",
} as const;

/** پالت چرخشی نمودارهای دایره‌ای/میله‌ای — همه از توکن‌ها */
export const CHART_SERIES = [
  CHART_TOKENS.primary,
  CHART_TOKENS.success,
  CHART_TOKENS.warning,
  CHART_TOKENS.destructive,
  CHART_TOKENS.info,
  CHART_TOKENS.muted,
];

/** استایل مشترک tooltip رچارتز، هماهنگ با توکن‌ها */
export const CHART_TOOLTIP_STYLE = {
  fontFamily: "Vazirmatn, sans-serif",
  fontSize: 12,
  direction: "rtl" as const,
  borderRadius: "14px",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
};

/* ------------------------------------------------------------------ */
/* ظرف نمودار — کارت با سربرگ و توضیح، مطابق مرجع                      */
/* ------------------------------------------------------------------ */

export function ChartCard({
  title,
  description,
  action,
  legend,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-4 sm:p-5 ${className ?? ""}`}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-extrabold text-foreground">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
          )}
        </div>
        {(action || legend) && (
          <div className="flex shrink-0 items-center gap-3">
            {legend}
            {action}
          </div>
        )}
      </div>
      {children}
    </Card>
  );
}

/** راهنمای رنگ نمودار (legend) — مطابق مرجع */
export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-3">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: it.color }} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* کارت KPI گزارش — مطابق ردیف پایین مرجع                              */
/* ------------------------------------------------------------------ */

const REPORT_KPI_TONE = {
  primary: {
    card: "bg-primary text-primary-foreground border-primary",
    label: "text-primary-foreground/90",
    value: "text-primary-foreground",
    unit: "text-primary-foreground/90",
    icon: "bg-primary-foreground/15 text-primary-foreground",
    chip: "bg-primary-foreground/15 text-primary-foreground",
  },
  plain: {
    card: "bg-card text-card-foreground border-border",
    label: "text-muted-foreground",
    value: "text-foreground",
    unit: "text-muted-foreground",
    icon: "bg-muted text-muted-foreground",
    chip: "bg-primary/10 text-primary",
  },
} as const;

export function ReportKpiCard({
  label,
  value,
  unit,
  chip,
  icon: Icon,
  tone = "plain",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  chip?: string;
  icon?: React.ElementType;
  tone?: keyof typeof REPORT_KPI_TONE;
}) {
  const t = REPORT_KPI_TONE[tone];
  return (
    <div className={`h-full rounded-[1.5rem] border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${t.card}`}>
      <div className="flex items-start justify-between gap-2">
        {Icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>
            <Icon size={18} strokeWidth={2.2} />
          </div>
        )}
        {chip && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tabular-nums ${t.chip}`}>
            {chip}
          </span>
        )}
      </div>
      <p className={`mt-3 text-xs font-medium ${t.label}`}>{label}</p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={`truncate text-xl font-black tabular-nums ${t.value}`}>{value}</span>
        {unit && <span className={`text-[11px] ${t.unit}`}>{unit}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* نشان رشد/افت — ستون «وضعیت رشد» مرجع                                */
/* ------------------------------------------------------------------ */

export function GrowthBadge({ percent }: { percent: number }) {
  const up = percent >= 0;
  return (
    <Badge tone={up ? "success" : "danger"}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {up ? "+" : "−"}
      {Math.abs(percent).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* فیلتر بازه زمانی — پیش‌تنظیم‌ها + بازه دلخواه با DatePicker شمسی      */
/* ------------------------------------------------------------------ */

export type RangePreset = "today" | "week" | "month" | "custom";

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: "today", label: "امروز" },
  { id: "week", label: "هفته اخیر" },
  { id: "month", label: "ماه جاری" },
  { id: "custom", label: "انتخاب بازه زمانی" },
];

/**
 * نوار فیلتر بازه — از همان `DatePicker` شمسی موجود پروژه استفاده می‌کند
 * و تقویم جدیدی معرفی نمی‌کند.
 */
export function ReportRangeFilter({
  preset,
  onPresetChange,
  from,
  to,
  onFromChange,
  onToChange,
  action,
}: {
  preset: RangePreset;
  onPresetChange: (p: RangePreset) => void;
  from?: string;
  to?: string;
  onFromChange?: (v: string) => void;
  onToChange?: (v: string) => void;
  action?: ReactNode;
}) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:pb-0" role="group" aria-label="بازه زمانی">
          {PRESETS.map((p) => {
            const active = preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPresetChange(p.id)}
                aria-pressed={active}
                className={[
                  "shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-ring",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
                ].join(" ")}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {preset === "custom" && onFromChange && onToChange && (
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <DatePicker label="از تاریخ" value={from ?? ""} onChange={onFromChange} />
          <DatePicker label="تا تاریخ" value={to ?? ""} onChange={onToChange} />
        </div>
      )}
    </Card>
  );
}
