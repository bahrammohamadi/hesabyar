"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, StatCard, Spinner } from "@/components/shared/ui";
import { formatToman, formatNumber, toFaDigits } from "@/lib/utils/format";
import type { DashboardSummary } from "@/types/db";
import {
  TrendingUp,
  Wallet,
  Package,
  AlertTriangle,
  ShoppingBag,
  Receipt,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { toJalali } from "@/lib/utils/format";

export default function DashboardPage() {
  const { orgId, loading: orgLoading } = useOrg();

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<DashboardSummary> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("dashboard_summary", {
        p_org: orgId,
      });
      if (error) throw error;
      return data as DashboardSummary;
    },
  });

  const chartQuery = useQuery({
    queryKey: ["sales-chart", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("sales_chart_30d", {
        p_org: orgId,
      });
      if (error) throw error;
      return (data as { day: string; total: number }[]).map((d) => ({
        day: toJalali(d.day).slice(5),
        total: Math.round(d.total / 10),
      }));
    },
  });

  if (orgLoading || summaryQuery.isLoading) {
    return <Spinner label="در حال بارگذاری داشبورد..." />;
  }

  const s = summaryQuery.data;

  return (
    <div>
      <PageHeader title="داشبورد مدیریتی" subtitle="نمای کلی کسب‌وکار شما" />

      {/* کارت‌های آماری */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="فروش امروز"
          value={formatToman(s?.sales_today)}
          hint={`${toFaDigits(s?.sales_today_count ?? 0)} فاکتور`}
          icon={<Receipt size={20} />}
          tone="blue"
        />
        <StatCard
          title="فروش این ماه"
          value={formatToman(s?.sales_month)}
          icon={<TrendingUp size={20} />}
          tone="green"
        />
        <StatCard
          title="هزینه‌های این ماه"
          value={formatToman(s?.expenses_month)}
          icon={<ArrowUpCircle size={20} />}
          tone="red"
        />
        <StatCard
          title="سود تقریبی این ماه"
          value={formatToman(s?.profit_month)}
          icon={<TrendingUp size={20} />}
          tone="green"
        />
        <StatCard
          title="ارزش موجودی انبار"
          value={formatToman(s?.inventory_value)}
          icon={<Package size={20} />}
        />
        <StatCard
          title="کالاهای کم‌موجود"
          value={toFaDigits(s?.low_stock_count ?? 0)}
          hint="نیازمند بررسی"
          icon={<AlertTriangle size={20} />}
          tone={s && s.low_stock_count > 0 ? "amber" : "default"}
        />
        <StatCard
          title="موجودی صندوق و بانک"
          value={formatToman(s?.cash_total)}
          icon={<Wallet size={20} />}
        />
        <StatCard
          title="بدهی مشتریان"
          value={formatToman(s?.customers_debt)}
          hint={`طلب از تامین‌کنندگان: ${formatToman(s?.suppliers_credit, false)}`}
          icon={<ArrowDownCircle size={20} />}
        />
      </div>

      {/* نمودار فروش */}
      <div className="card p-4 sm:p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">نمودار فروش ۳۰ روز اخیر</h2>
          <ShoppingBag size={20} className="text-slate-400" />
        </div>
        {chartQuery.isLoading ? (
          <Spinner />
        ) : !chartQuery.data || chartQuery.data.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-12">
            هنوز فروشی ثبت نشده است.
          </div>
        ) : (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartQuery.data}>
                <defs>
                  <linearGradient id="sales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1d60f2" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1d60f2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="#94a3b8"
                  tickFormatter={(v) => (v >= 1000000 ? `${v / 1000000}M` : `${v / 1000}k`)}
                />
                <Tooltip
                  formatter={(v: number) => [formatNumber(v) + " تومان", "فروش"]}
                  contentStyle={{ fontFamily: "Vazirmatn", fontSize: 12, direction: "rtl" }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#1d60f2"
                  strokeWidth={2}
                  fill="url(#sales)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
