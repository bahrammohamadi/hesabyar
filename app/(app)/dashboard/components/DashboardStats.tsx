"use client";

import Link from "next/link";
import {
  AlertTriangle,
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
import type { DashboardLowStockItem } from "./DashboardLowStock";

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
  trend,
  href,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  trend?: "up" | "down" | "neutral";
  href?: string;
  onClick?: () => void;
}) {
  const trendIcon =
    trend === "up" ? (
      <ArrowUpRight size={13} className="text-emerald-500" />
    ) : trend === "down" ? (
      <ArrowDownRight size={13} className="text-rose-400" />
    ) : null;

  const inner = (
    <div className="group relative overflow-hidden rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-900/[0.04] backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md hover:shadow-slate-900/[0.07]">
      {/* رنگ پس‌زمینه آیکون به‌صورت blob */}
      <div className={`absolute -left-4 -top-4 h-20 w-20 rounded-full opacity-[0.07] ${iconBg}`} />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-xs font-medium text-slate-400">{label}</p>
          <p className="truncate text-xl font-extrabold tracking-tight text-slate-800">{value}</p>
          {sub && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
              {trendIcon}
              {sub}
            </div>
          )}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg} ${iconColor} shadow-sm`}>
          <Icon size={18} strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );

  if (href)
    return (
      <Link href={href} className="block no-underline">
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button onClick={onClick} className="w-full text-right">
        {inner}
      </button>
    );
  return inner;
}

function SectionLabel({ color, label }: { color: string; label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className={`h-4 w-1 rounded-full ${color}`} />
      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
    </div>
  );
}

export function DashboardStats({
  summary,
  lowStockItems,
  onOpenExpense,
  onOpenReceipt,
}: {
  summary: DashboardSummary | undefined;
  lowStockItems?: DashboardLowStockItem[];
  onOpenExpense: () => void;
  onOpenReceipt: () => void;
}) {
  const lowStockCount = summary?.low_stock_count ?? 0;

  return (
    <div className="space-y-6">
      {/* ردیف اول — ۴ KPI اصلی */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="فروش امروز"
          value={formatToman(summary?.sales_today)}
          sub={`${toFaDigits(summary?.sales_today_count ?? 0)} فاکتور`}
          icon={TrendingUp}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          trend="up"
          href="/sales"
        />
        <KpiCard
          label="فروش این ماه"
          value={formatToman(summary?.sales_month)}
          sub={`سود: ${formatToman(summary?.profit_month ?? 0, false)}`}
          icon={BarChart2}
          iconBg="bg-violet-100"
          iconColor="text-violet-600"
          trend="up"
          href="/sales"
        />
        <KpiCard
          label="موجودی صندوق"
          value={formatToman(summary?.cash_total)}
          icon={Wallet}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          trend="neutral"
          href="/finance"
        />
        <KpiCard
          label="ارزش انبار"
          value={formatToman(summary?.inventory_value)}
          icon={Package}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          trend="neutral"
          href="/products"
        />
      </div>

      {/* ردیف دوم — ۳ ستون */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* مانده‌ها */}
        <div>
          <SectionLabel color="bg-rose-400" label="مانده طرفین" />
          <div className="space-y-2.5">
            {/* طلب مشتریان */}
            <Link
              href="/contacts/debtors"
              className="group flex items-center justify-between rounded-2xl border border-white/80 bg-white/90 p-3.5 shadow-sm shadow-slate-900/[0.03] transition hover:border-rose-200 hover:bg-rose-50/40 hover:shadow-rose-100"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-500">
                  <ArrowUpRight size={15} />
                </div>
                <span className="text-sm font-medium text-slate-600">طلب از مشتریان</span>
              </div>
              <span className="text-sm font-bold text-rose-600">
                {formatToman(summary?.customers_debt ?? 0, false)}
              </span>
            </Link>
            {/* طلب تأمین‌کننده */}
            <Link
              href="/contacts/creditors"
              className="group flex items-center justify-between rounded-2xl border border-white/80 bg-white/90 p-3.5 shadow-sm shadow-slate-900/[0.03] transition hover:border-emerald-200 hover:bg-emerald-50/40"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <ArrowDownRight size={15} />
                </div>
                <span className="text-sm font-medium text-slate-600">طلب تأمین‌کنندگان</span>
              </div>
              <span className="text-sm font-bold text-emerald-600">
                {formatToman(summary?.suppliers_credit ?? 0, false)}
              </span>
            </Link>
          </div>
        </div>

        {/* عملیات مالی سریع */}
        <div>
          <SectionLabel color="bg-emerald-500" label="عملیات مالی" />
          <div className="space-y-2.5">
            <button
              onClick={onOpenReceipt}
              className="group flex w-full items-center justify-between rounded-2xl border border-white/80 bg-white/90 p-3.5 text-right shadow-sm shadow-slate-900/[0.03] transition hover:border-emerald-200 hover:bg-emerald-50/40"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 transition group-hover:scale-105">
                  <ArrowDownRight size={15} />
                </div>
                <span className="text-sm font-medium text-slate-600">ثبت دریافت وجه</span>
              </div>
              <span className="text-xs text-slate-300 transition group-hover:text-emerald-400">← ثبت</span>
            </button>
            <button
              onClick={onOpenExpense}
              className="group flex w-full items-center justify-between rounded-2xl border border-white/80 bg-white/90 p-3.5 text-right shadow-sm shadow-slate-900/[0.03] transition hover:border-rose-200 hover:bg-rose-50/40"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-500 transition group-hover:scale-105">
                  <ArrowUpRight size={15} />
                </div>
                <span className="text-sm font-medium text-slate-600">ثبت هزینه</span>
              </div>
              <span className="text-xs text-slate-300 transition group-hover:text-rose-400">
                {formatToman(summary?.expenses_month ?? 0, false)} این ماه
              </span>
            </button>
          </div>
        </div>

        {/* هشدار موجودی */}
        <div>
          <SectionLabel color="bg-amber-400" label="هشدار انبار" />
          <div
            className={`rounded-2xl border p-4 shadow-sm shadow-slate-900/[0.03] transition ${
              lowStockCount > 0
                ? "border-amber-200/60 bg-amber-50/60"
                : "border-white/80 bg-white/90"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">کالاهای کم‌موجود</p>
                <p
                  className={`mt-0.5 text-2xl font-extrabold ${
                    lowStockCount > 0 ? "text-amber-600" : "text-slate-300"
                  }`}
                >
                  {toFaDigits(lowStockCount)}
                  <span className="mr-1 text-base font-medium">مورد</span>
                </p>
              </div>
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                  lowStockCount > 0 ? "bg-amber-100 text-amber-500" : "bg-slate-100 text-slate-300"
                }`}
              >
                <AlertTriangle size={20} strokeWidth={2} />
              </div>
            </div>

            {lowStockCount > 0 && lowStockItems && lowStockItems.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {lowStockItems.slice(0, 3).map((item) => (
                  <div key={item.variant_id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-600">
                      {item.product_name}
                      {(item.color || item.size) && (
                        <span className="text-slate-400">
                          {" "}
                          · {[item.color, item.size].filter(Boolean).join("/")}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 rounded-lg bg-amber-100 px-2 py-0.5 font-bold text-amber-700">
                      {toFaDigits(item.stock_qty)}
                    </span>
                  </div>
                ))}
                {lowStockCount > 3 && (
                  <Link
                    href="/inventory/movements"
                    className="mt-1 block text-[11px] font-medium text-amber-600 hover:underline"
                  >
                    و {toFaDigits(lowStockCount - 3)} مورد دیگر ←
                  </Link>
                )}
              </div>
            )}

            {lowStockCount > 0 && (
              <Link
                href="/inventory/in"
                className="mt-3 block text-center rounded-xl bg-amber-100 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-200"
              >
                ثبت ورود کالا
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
