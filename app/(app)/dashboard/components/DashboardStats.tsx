"use client";

import Link from "next/link";
import { ArrowDownCircle, ArrowUpCircle, ChevronRight, Package, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import { StatCard } from "@/components/shared/ui";
import { formatToman, toFaDigits } from "@/lib/utils/format";
import type { DashboardSummary } from "@/types/db";
import { DashboardLowStock, type DashboardLowStockItem } from "./DashboardLowStock";

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
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
      {/* ستون اول: مالیات (Finance) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-5 bg-emerald-600 rounded-full" />
          <h2 className="text-sm font-bold text-slate-800">وضعیت مالی</h2>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <StatCard label="موجودی صندوق" value={formatToman(summary?.cash_total)} icon={Wallet} trend="neutral" color="emerald" href="/finance" />
          <StatCard
            label="فروش امروز"
            value={formatToman(summary?.sales_today)}
            subValue={`${toFaDigits(summary?.sales_today_count ?? 0)} فاکتور`}
            icon={TrendingUp}
            trend="up"
            color="primary"
            href="/sales"
          />
          <button onClick={onOpenExpense} className="card p-4 text-right hover:bg-rose-50 transition-colors group flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">هزینه‌های ماه</div>
              <div className="text-lg font-bold text-slate-800">{formatToman(summary?.expenses_month)}</div>
            </div>
            <ArrowUpCircle className="text-slate-300 group-hover:text-rose-500 transition-colors" size={24} />
          </button>
        </div>
      </div>

      {/* ستون دوم: فروش و سود (Sales & Profit) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <h2 className="text-sm font-bold text-slate-800">عملکرد فروش</h2>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <StatCard
            label="فروش این ماه"
            value={formatToman(summary?.sales_month)}
            subValue={`سود: ${formatToman(summary?.profit_month, false)}`}
            icon={ShoppingBag}
            trend="up"
            color="violet"
            href="/sales"
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4 text-right group hover:border-rose-200 transition-colors">
              <div className="text-[11px] text-slate-400 mb-1">طلب مشتریان</div>
              <div className="text-sm font-bold text-rose-600">{formatToman(summary?.customers_debt)}</div>
            </div>
            <div className="card p-4 text-right group hover:border-emerald-200 transition-colors">
              <div className="text-[11px] text-slate-400 mb-1">طلب تأمین‌کننده</div>
              <div className="text-sm font-bold text-emerald-600">{formatToman(summary?.suppliers_credit)}</div>
            </div>
          </div>
          <div className="card p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group" onClick={onOpenReceipt}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <ArrowDownCircle size={16} />
              </div>
              <span className="text-sm font-medium text-slate-700">ثبت دریافت وجه</span>
            </div>
            <ChevronRight size={16} className="text-slate-300 group-hover:text-primary transition-colors" />
          </div>
        </div>
      </div>

      {/* ستون سوم: انبار (Inventory) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-5 bg-blue-600 rounded-full" />
          <h2 className="text-sm font-bold text-slate-800">مدیریت انبار</h2>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <StatCard label="ارزش کل انبار" value={formatToman(summary?.inventory_value)} icon={Package} trend="neutral" color="blue" href="/products" />
          <DashboardLowStock lowStockCount={summary?.low_stock_count ?? 0} items={lowStockItems} />
        </div>
      </div>
    </div>
  );
}
