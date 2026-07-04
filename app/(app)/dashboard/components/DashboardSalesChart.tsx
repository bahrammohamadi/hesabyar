"use client";

import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { Spinner } from "@/components/shared/ui";
import { formatNumber } from "@/lib/utils/format";

export type SalesChartPoint = {
  day: string;
  total: number;
};

export function DashboardSalesChart({ isLoading, data }: { isLoading: boolean; data: SalesChartPoint[] | undefined }) {
  return (
    <div className="lg:col-span-2 card p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <TrendingUp size={20} className="text-primary" />
          روند فروش ۳۰ روز اخیر
        </h3>
        <Link href="/reports" className="text-xs text-primary hover:underline">
          گزارش تحلیل فروش
        </Link>
      </div>
      {isLoading ? (
        <Spinner />
      ) : !data || data.length === 0 ? (
        <div className="text-center text-sm text-slate-400 py-16">داده‌ای برای نمایش در نمودار یافت نشد.</div>
      ) : (
        <div className="h-56 sm:h-72" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v) => (v >= 1000000 ? `${v / 1000000}M` : `${v / 1000}k`)}
              />
              <Tooltip formatter={(v: number) => [formatNumber(v) + " تومان", "فروش"]} contentStyle={{ fontFamily: "Vazirmatn", fontSize: 12, direction: "rtl", borderRadius: "12px" }} />
              <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#salesGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
