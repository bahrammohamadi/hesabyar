"use client";

/**
 * قطعات بصری مدیریت مشتریان (CRM) — مطابق مرجع طراحی «مدیریت مشتریان».
 *
 * ⚠️ این فایل فقط «ظرف بصری» است. هیچ کوئری، منطق سگمنت‌بندی یا محاسبه‌ی
 * مانده حساب اینجا انجام نمی‌شود؛ همه از صفحه‌ی مصرف‌کننده pass می‌شوند.
 */

import type { ReactNode } from "react";
import { Badge, Card } from "@/src/shared/ui";
import { toFaDigits } from "@/lib/utils/format";

/* ------------------------------------------------------------------ */
/* کارت‌های KPI بالای صفحه — مطابق مرجع (چهار کارت رنگی)               */
/* ------------------------------------------------------------------ */

const KPI_TONE = {
  primary: {
    card: "bg-primary text-primary-foreground border-primary",
    label: "text-primary-foreground/70",
    value: "text-primary-foreground",
    icon: "bg-primary-foreground/15 text-primary-foreground",
    chip: "bg-primary-foreground/15 text-primary-foreground",
    blob: "bg-primary-foreground",
  },
  accent: {
    card: "bg-accent text-accent-foreground border-border",
    label: "text-muted-foreground",
    value: "text-foreground",
    icon: "bg-primary/10 text-primary",
    chip: "bg-primary/10 text-primary",
    blob: "bg-primary",
  },
  danger: {
    card: "bg-destructive/[0.07] text-foreground border-destructive/20",
    label: "text-destructive/80",
    value: "text-destructive",
    icon: "bg-destructive/10 text-destructive",
    chip: "bg-destructive/10 text-destructive",
    blob: "bg-destructive",
  },
  info: {
    card: "bg-info-soft text-foreground border-info/20",
    label: "text-info/80",
    value: "text-foreground",
    icon: "bg-info/15 text-info",
    chip: "bg-info/15 text-info",
    blob: "bg-info",
  },
} as const;

export type CrmKpiTone = keyof typeof KPI_TONE;

export function CrmKpiCard({
  label,
  value,
  chip,
  icon: Icon,
  tone = "accent",
}: {
  label: string;
  value: ReactNode;
  chip?: string;
  icon: React.ElementType;
  tone?: CrmKpiTone;
}) {
  const t = KPI_TONE[tone];
  return (
    <div className={`relative h-full overflow-hidden rounded-[1.75rem] border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${t.card}`}>
      <div className={`pointer-events-none absolute -left-5 -bottom-5 h-24 w-24 rounded-full opacity-[0.08] ${t.blob}`} aria-hidden />
      <div className="relative flex items-start justify-between gap-2">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>
          <Icon size={18} strokeWidth={2.2} />
        </div>
        {chip && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${t.chip}`}>{chip}</span>
        )}
      </div>
      <div className="relative mt-3">
        <p className={`text-xs font-medium ${t.label}`}>{label}</p>
        <p className={`mt-1 truncate text-xl font-black tabular-nums sm:text-2xl ${t.value}`}>{value}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* نشان سطح کاربری (VIP / معمولی) — مطابق ستون «سطح کاربری» مرجع        */
/* ------------------------------------------------------------------ */

export function CustomerTierBadge({ tier }: { tier: string }) {
  const tone = tier === "VIP" ? "success" : tier === "غیرفعال" ? "danger" : tier === "وفادار" ? "primary" : "neutral";
  return <Badge tone={tone as any}>{tier}</Badge>;
}

/* ------------------------------------------------------------------ */
/* ترکیب مشتریان — نمودار دونات با توکن‌های معنایی                      */
/* ------------------------------------------------------------------ */

export function CrmCompositionCard({
  total,
  slices,
}: {
  total: number;
  slices: { label: string; value: number; className: string; stroke: string }[];
}) {
  const sum = slices.reduce((s, x) => s + x.value, 0) || 1;
  const R = 54;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="mb-4 text-sm font-extrabold text-foreground">ترکیب مشتریان</h2>

      <div className="flex items-center justify-center">
        <div className="relative h-40 w-40">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle cx="70" cy="70" r={R} fill="none" strokeWidth="16" className="stroke-muted" />
            {slices.map((s) => {
              const len = (s.value / sum) * C;
              const el = (
                <circle
                  key={s.label}
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  strokeWidth="16"
                  strokeLinecap="butt"
                  stroke={s.stroke}
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black tabular-nums text-foreground">{toFaDigits(total)}</span>
            <span className="text-[11px] text-muted-foreground">مجموع</span>
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${s.className}`} />
              <span className="text-foreground/80">{s.label}</span>
            </span>
            <span className="font-bold tabular-nums text-muted-foreground">
              {toFaDigits(Math.round((s.value / sum) * 100))}٪
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* فعالیت‌های اخیر مشتریان                                              */
/* ------------------------------------------------------------------ */

export function CrmActivityCard({
  items,
  action,
}: {
  items: { id: string; title: string; description?: string | null; time?: string | null; icon: React.ElementType }[];
  action?: ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold text-foreground">فعالیت‌های اخیر مشتریان</h2>
        {action}
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">فعالیتی ثبت نشده است</p>
      ) : (
        <ul className="space-y-3">
          {items.map(({ id, title, description, time, icon: Icon }) => (
            <li key={id} className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Icon size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{title}</p>
                {description && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{description}</p>
                )}
              </div>
              {time && <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{time}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
