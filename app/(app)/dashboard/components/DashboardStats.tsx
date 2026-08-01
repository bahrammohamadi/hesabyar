"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  Package,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatToman, toFaDigits } from "@/lib/utils/format";
import type { DashboardSummary } from "@/types/db";

/**
 * پالت کارت‌های KPI — مطابق مرجع طراحی (چهار کارت رنگی).
 * همه‌ی رنگ‌ها از توکن‌های معنایی پروژه می‌آیند تا دارک‌مود و تعویض تم کار کند.
 */
const kpiToneClass = {
  primary: {
    card: "bg-primary text-primary-foreground border-primary",
    label: "text-primary-foreground/90",
    value: "text-primary-foreground",
    sub: "text-primary-foreground/90",
    icon: "bg-primary-foreground/15 text-primary-foreground",
    blob: "bg-primary-foreground",
  },
  success: {
    card: "bg-success-soft text-foreground border-success/20",
    label: "text-success-onSoft",
    value: "text-foreground",
    sub: "text-muted-foreground",
    icon: "bg-success-soft text-success-onSoft",
    blob: "bg-success",
  },
  accent: {
    /*
      accent از تم فعال می‌آید و ممکن است روشن باشد.
      برچسب را به foreground می‌بریم چون muted-foreground روی
      برخی تم‌ها فقط ۳.۸ کنتراست می‌داد.
    */
    card: "bg-accent text-accent-foreground border-border",
    label: "text-foreground",
    value: "text-foreground",
    sub: "text-muted-foreground",
    icon: "bg-primary/10 text-primary",
    blob: "bg-primary",
  },
  info: {
    card: "bg-info-soft text-foreground border-info/20",
    label: "text-info-onSoft",
    value: "text-foreground",
    sub: "text-muted-foreground",
    icon: "bg-info-soft text-info-onSoft",
    blob: "bg-info",
  },
} as const;

export type KpiTone = keyof typeof kpiToneClass;

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "accent",
  trend,
  href,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ElementType;
  tone?: KpiTone;
  trend?: "up" | "down" | "neutral";
  href?: string;
  onClick?: () => void;
}) {
  const t = kpiToneClass[tone];
  const trendIcon =
    trend === "up" ? (
      <ArrowUpRight size={13} className="shrink-0" />
    ) : trend === "down" ? (
      <ArrowDownRight size={13} className="shrink-0" />
    ) : null;

  const inner = (
    <div
      className={`group relative h-full overflow-hidden rounded-[1.75rem] border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${t.card}`}
    >
      {/* دکور پس‌زمینه — مطابق مرجع */}
      <div className={`pointer-events-none absolute -left-5 -bottom-5 h-24 w-24 rounded-full opacity-[0.08] ${t.blob}`} aria-hidden />

      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`mb-1.5 text-xs font-medium ${t.label}`}>{label}</p>
          <p className={`truncate text-xl font-black tracking-tight tabular-nums sm:text-2xl ${t.value}`}>{value}</p>
          {sub && (
            <div className={`mt-1.5 flex items-center gap-1 text-[11px] ${t.sub}`}>
              {trendIcon}
              <span className="truncate">{sub}</span>
            </div>
          )}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>
          <Icon size={18} strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );

  if (href)
    return (
      <Link href={href} className="block h-full no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[1.75rem]">
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button onClick={onClick} className="h-full w-full text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[1.75rem]">
        {inner}
      </button>
    );
  return inner;
}

function SectionLabel({ color, label }: { color: string; label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className={`h-4 w-1 rounded-full ${color}`} />
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

export function DashboardStats({
  summary,
  onOpenExpense,
  onOpenReceipt,
}: {
  summary: DashboardSummary | undefined;
  onOpenExpense: () => void;
  onOpenReceipt: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* ردیف اول — ۴ KPI اصلی */}
      <div className="stagger-in grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <KpiCard
          label="فروش امروز"
          value={formatToman(summary?.sales_today)}
          sub={`${toFaDigits(summary?.sales_today_count ?? 0)} فاکتور`}
          icon={TrendingUp}
          tone="primary"
          trend="up"
          href="/sales"
        />
        <KpiCard
          label="فروش این ماه"
          value={formatToman(summary?.sales_month)}
          sub={`سود: ${formatToman(summary?.profit_month ?? 0, false)}`}
          icon={BarChart2}
          tone="success"
          trend="up"
          href="/sales"
        />
        <KpiCard
          label="موجودی صندوق"
          value={formatToman(summary?.cash_total)}
          icon={Wallet}
          tone="accent"
          trend="neutral"
          href="/finance"
        />
        <KpiCard
          label="ارزش انبار"
          value={formatToman(summary?.inventory_value)}
          icon={Package}
          tone="info"
          trend="neutral"
          href="/products"
        />
      </div>

      {/* ردیف دوم — ۳ ستون */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* مانده‌ها */}
        <div>
          <SectionLabel color="bg-finance-debt" label="مانده طرفین" />
          <div className="space-y-2.5">
            {/* طلب مشتریان */}
            <Link
              href="/contacts/debtors"
              className="group flex items-center justify-between rounded-2xl border border-border bg-card p-3.5 shadow-sm transition hover:border-finance-debt/30 hover:bg-finance-debt/[0.06]"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-finance-debt/10 text-finance-debt">
                  <ArrowUpRight size={15} />
                </div>
                <span className="text-sm font-medium text-foreground/80">طلب از مشتریان</span>
              </div>
              <span className="text-sm font-bold tabular-nums text-finance-debt">
                {formatToman(summary?.customers_debt ?? 0, false)}
              </span>
            </Link>
            {/* طلب تأمین‌کننده */}
            <Link
              href="/contacts/creditors"
              className="group flex items-center justify-between rounded-2xl border border-border bg-card p-3.5 shadow-sm transition hover:border-finance-credit/30 hover:bg-finance-credit/[0.06]"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-finance-credit/10 text-finance-credit">
                  <ArrowDownRight size={15} />
                </div>
                <span className="text-sm font-medium text-foreground/80">طلب تأمین‌کنندگان</span>
              </div>
              <span className="text-sm font-bold tabular-nums text-finance-credit">
                {formatToman(summary?.suppliers_credit ?? 0, false)}
              </span>
            </Link>
          </div>
        </div>

        {/* عملیات مالی سریع */}
        <div>
          <SectionLabel color="bg-finance-profit" label="عملیات مالی" />
          <div className="space-y-2.5">
            <button
              onClick={onOpenReceipt}
              className="group flex w-full items-center justify-between rounded-2xl border border-border bg-card p-3.5 text-right shadow-sm transition hover:border-success/30 hover:bg-success/[0.06]"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-success/10 text-success transition group-hover:scale-105">
                  <ArrowDownRight size={15} />
                </div>
                <span className="text-sm font-medium text-foreground/80">ثبت دریافت وجه</span>
              </div>
              <span className="text-xs text-muted-foreground transition group-hover:text-success">← ثبت</span>
            </button>
            <button
              onClick={onOpenExpense}
              className="group flex w-full items-center justify-between rounded-2xl border border-border bg-card p-3.5 text-right shadow-sm transition hover:border-destructive/30 hover:bg-destructive/[0.06]"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/10 text-destructive transition group-hover:scale-105">
                  <ArrowUpRight size={15} />
                </div>
                <span className="text-sm font-medium text-foreground/80">ثبت هزینه</span>
              </div>
              <span className="text-xs tabular-nums text-muted-foreground transition group-hover:text-destructive">
                {formatToman(summary?.expenses_month ?? 0, false)} این ماه
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
