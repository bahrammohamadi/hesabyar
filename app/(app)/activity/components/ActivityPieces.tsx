"use client";

/**
 * قطعات بصری گزارش فعالیت — مطابق مرجع طراحی «آخرین فعالیت‌های سیستم».
 *
 * ⚠️ فقط ظرف بصری. منبع دادهٔ audit trigger (`activity_logs` از طریق
 * `/api/activity`) اصلاً در این فایل لمس نشده است؛ همه‌چیز از صفحه pass می‌شود.
 */

import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  FilePenLine,
  Package,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";
import { Badge, Card } from "@/src/shared/ui";
import { toFaDigits } from "@/lib/utils/format";

/* ------------------------------------------------------------------ */
/* نگاشت نوع عملیات → آیکون + تون معنایی                                */
/* ------------------------------------------------------------------ */

type ActionTone = "success" | "warning" | "danger" | "info" | "primary" | "neutral";

const ACTION_META: Record<string, { icon: React.ElementType; tone: ActionTone }> = {
  create: { icon: CheckCircle2, tone: "success" },
  update: { icon: FilePenLine, tone: "info" },
  delete: { icon: Trash2, tone: "danger" },
  cancel: { icon: XCircle, tone: "danger" },
  payment: { icon: Wallet, tone: "primary" },
  price_change: { icon: FilePenLine, tone: "warning" },
  stock_adjust: { icon: Package, tone: "warning" },
  stock_in: { icon: ArrowDownToLine, tone: "success" },
  stock_out: { icon: ArrowUpFromLine, tone: "warning" },
  stock_waste: { icon: AlertTriangle, tone: "danger" },
};

export function actionMeta(action: string) {
  return ACTION_META[action] ?? { icon: FilePenLine, tone: "neutral" as ActionTone };
}

/** رنگ حلقهٔ آیکون تایم‌لاین، هم‌راستا با تون عملیات */
const RING_CLASS: Record<ActionTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  primary: "bg-primary/10 text-primary",
  neutral: "bg-muted text-muted-foreground",
};

/* ------------------------------------------------------------------ */
/* نشان نوع عملیات                                                     */
/* ------------------------------------------------------------------ */

export function ActionBadge({ action, label }: { action: string; label: string }) {
  const { tone } = actionMeta(action);
  return <Badge tone={tone === "neutral" ? "neutral" : tone}>{label}</Badge>;
}

/* ------------------------------------------------------------------ */
/* آواتار کاربر — حرف اول نام، مطابق مرجع                               */
/* ------------------------------------------------------------------ */

export function ActorAvatar({ name, className }: { name?: string | null; className?: string }) {
  const initial = (name || "؟").trim().slice(0, 1);
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary ${className ?? ""}`}
      aria-hidden
    >
      {initial}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* زمان نسبی فارسی — «۱۰ دقیقه پیش» مطابق مرجع                          */
/* ------------------------------------------------------------------ */

export function relativeTimeFa(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 0) return "هم‌اکنون";
  if (diffSec < 60) return "چند لحظه پیش";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${toFaDigits(min)} دقیقه پیش`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${toFaDigits(hr)} ساعت پیش`;
  const day = Math.floor(hr / 24);
  if (day < 31) return `${toFaDigits(day)} روز پیش`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${toFaDigits(month)} ماه پیش`;
  return `${toFaDigits(Math.floor(month / 12))} سال پیش`;
}

/* ------------------------------------------------------------------ */
/* یک ردیف تایم‌لاین — مطابق مرجع (خط عمودی + حلقهٔ آیکون)              */
/* ------------------------------------------------------------------ */

export function ActivityTimelineItem({
  action,
  title,
  meta,
  detail,
  time,
  isLast,
  trailing,
}: {
  action: string;
  title: ReactNode;
  meta?: ReactNode;
  detail?: ReactNode;
  time: string;
  isLast?: boolean;
  trailing?: ReactNode;
}) {
  const { icon: Icon, tone } = actionMeta(action);
  return (
    <li className="relative flex gap-3.5 pb-5 last:pb-0">
      {/* خط عمودی تایم‌لاین */}
      {!isLast && (
        <span
          className="absolute top-9 h-[calc(100%-2.25rem)] w-px bg-border ltr:left-[17px] rtl:right-[17px]"
          aria-hidden
        />
      )}

      <div className={`z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${RING_CLASS[tone]}`}>
        <Icon size={16} strokeWidth={2.2} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">{title}</div>
            {detail && <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>}
          </div>
          {trailing}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span className="tabular-nums">{time}</span>
          {meta && (
            <>
              <span aria-hidden>·</span>
              {meta}
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* ظرف فید فعالیت                                                      */
/* ------------------------------------------------------------------ */

export function ActivityFeedCard({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
          {Icon && <Icon size={17} className="text-muted-foreground" />}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </Card>
  );
}
