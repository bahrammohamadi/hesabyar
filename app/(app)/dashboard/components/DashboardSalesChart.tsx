"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { Spinner } from "@/src/shared/ui";
import { formatNumber } from "@/lib/utils/format";

export type SalesChartPoint = { day: string; total: number };

export function DashboardSalesChart({
  isLoading,
  data,
}: {
  isLoading: boolean;
  data: SalesChartPoint[] | undefined;
}) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-card p-4 shadow-sm sm:p-5">
      {/* هدر */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TrendingUp size={17} strokeWidth={2.2} />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-foreground">روند فروش</h2>
            <p className="text-2xs text-muted-foreground">۳۰ روز اخیر</p>
          </div>
        </div>
        <Link
          href="/reports"
          className="rounded-xl bg-muted px-3 py-1.5 text-2xs font-medium text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
        >
          گزارش کامل
        </Link>
      </div>

      {/* نمودار */}
      {isLoading ? (
        <div className="flex h-56 items-center justify-center">
          <Spinner />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2">
          <TrendingUp size={32} className="text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">هنوز داده‌ای برای نمایش وجود ندارد</p>
        </div>
      ) : (
        <div className="h-56 sm:h-64" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1_000_000 ? `${v / 1_000_000}M` : `${v / 1000}k`
                }
                width={38}
              />
              <Tooltip
                formatter={(v: number) => [formatNumber(v) + " تومان", "فروش"]}
                contentStyle={{
                  fontFamily: "Vazirmatn, sans-serif",
                  fontSize: 12,
                  direction: "rtl",
                  borderRadius: "14px",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                  background: "hsl(var(--popover))",
                  color: "hsl(var(--popover-foreground))",
                }}
                cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 2" }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill="url(#chartGrad)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0, fill: "hsl(var(--primary))" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
