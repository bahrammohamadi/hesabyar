"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { Badge, Button, Card, ChartTooltip, DataTable, axisProps, chartCursor, compactAxisNumber, useChartAnimation } from "@/src/shared/ui";
import {
  CHART_SERIES,
  CHART_TOKENS,
  ChartCard,
  ReportKpiCard,
} from "./components/ReportPieces";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { formatToman, toFaDigits } from "@/lib/utils/format";
import { toJalali, todayJalali, rialToToman } from "@/lib/utils/format";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Package,
  Wallet,
  Users,
  Calendar,
  Download,
} from "lucide-react";
import { downloadCsv } from "@/lib/export/download";
import { useToast } from "@/src/shared/ui";

type TabId = "sales" | "products" | "financial" | "contacts" | "profit";

const TABS: { id: TabId; label: string; icon: typeof TrendingUp }[] = [
  { id: "sales", label: "فروش", icon: TrendingUp },
  { id: "products", label: "محصولات", icon: Package },
  { id: "financial", label: "مالی", icon: Wallet },
  { id: "contacts", label: "اشخاص", icon: Users },
  { id: "profit", label: "سود و زیان", icon: TrendingUp },
];

// پالت نمودارها از توکن‌های معنایی پروژه می‌آید (نه hex خام مرجع).
const COLORS = CHART_SERIES;



// --- فروش ---
function SalesReport({ orgId }: { orgId: string }) {
  /* Recharts انیمیشن را در JS اجرا می‌کند؛ CSS سراسری خنثی‌اش نمی‌کند. */
  const animate = useChartAnimation();
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "1y">("30d");

  const { data: chartData, isLoading } = useQuery({
    queryKey: ["report-sales-chart", orgId, period],
    queryFn: async () => {
      const supabase = createClient();
      const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365;
      const { data, error } = await supabase.rpc("sales_chart_30d", { p_org: orgId });
      if (error) throw error;
      return (data as { day: string; total: number }[]).map((d) => ({
        date: toJalali(d.day).slice(5),
        فروش: Math.round(d.total / 10),
      }));
    },
  });

  const { data: summary } = useQuery({
    queryKey: ["report-sales-summary", orgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("dashboard_summary", { p_org: orgId });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      {/* خلاصه آمار */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <ReportKpiCard label="فروش امروز" value={formatToman(summary?.sales_today ?? 0, false)} unit="تومان" icon={TrendingUp} tone="primary" />
        <ReportKpiCard label="فروش ماه" value={formatToman(summary?.sales_month ?? 0, false)} unit="تومان" icon={Wallet} />
        <ReportKpiCard label="فاکتور امروز" value={toFaDigits(summary?.sales_today_count ?? 0)} unit="فاکتور" icon={Calendar} />
        <ReportKpiCard label="سود ماه" value={formatToman(summary?.profit_month ?? 0, false)} unit="تومان" icon={TrendingUp} />
      </div>

      {/* انتخاب بازه زمانی */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {(["7d", "30d", "90d", "1y"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-ring ${
              period === p
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            {p === "7d" ? "۷ روز" : p === "30d" ? "۳۰ روز" : p === "90d" ? "۹۰ روز" : "یک سال"}
          </button>
        ))}
      </div>

      {/* نمودار */}
      <div className="rounded-[1.75rem] border border-border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-sm font-extrabold text-foreground">نمودار فروش</h2>
        {isLoading ? (
          <Spinner />
        ) : !chartData?.length ? (
          <EmptyState icon={TrendingUp} message="داده‌ای برای نمایش وجود ندارد" />
        ) : (
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_TOKENS.grid} vertical={false} />
                <XAxis dataKey="date" {...axisProps} />
                {/*
                  🔴 محور با ارقام فارسی.
                  پیش از این «0k · 850k · 1.7M» نشان می‌داد — رقم لاتین
                  با پسوند انگلیسی، در برنامه‌ای که همه‌جایش فارسی است.
                  (اندازه‌گیری‌شده روی داده‌ی واقعی پیش از اصلاح.)
                */}
                <YAxis {...axisProps} tickFormatter={compactAxisNumber} width={68} />
                <Tooltip content={<ChartTooltip unit="تومان" />} cursor={chartCursor} />
                <Line type="monotone" dataKey="فروش" stroke={CHART_TOKENS.primary} strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))", fill: CHART_TOKENS.primary }} isAnimationActive={animate} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// --- محصولات ---
function ProductsReport({ orgId }: { orgId: string }) {
  /* Recharts انیمیشن را در JS اجرا می‌کند؛ CSS سراسری خنثی‌اش نمی‌کند. */
  const animate = useChartAnimation();
  const { data: topProducts, isLoading } = useQuery({
    queryKey: ["report-top-products", orgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sale_items")
        .select(`
          qty,
          line_total,
          variant:product_variants(product:products(id, name))
        `)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      if (error) throw error;

      const totals: Record<string, { id: string | null; name: string; revenue: number; qty: number }> = {};
      (data ?? []).forEach((item: any) => {
        const id = item.variant?.product?.id ?? null;
        const name = item.variant?.product?.name ?? "نامعلوم";
        const key = id ?? name;
        if (!totals[key]) totals[key] = { id, name, revenue: 0, qty: 0 };
        totals[key].revenue += (item.line_total ?? 0);
        totals[key].qty += item.qty ?? 0;
      });

      return Object.values(totals)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
    },
  });

  const { data: lowStock } = useQuery({
    queryKey: ["report-low-stock", orgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, stock_qty, product:products!inner(id, name)")
        .lte("stock_qty", 5)
        .eq("is_active", true)
        .order("stock_qty")
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      {/* پرفروش‌ترین‌ها */}
      <div className="rounded-[1.75rem] border border-border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-sm font-extrabold text-foreground">پرفروش‌ترین محصولات (۳۰ روز)</h2>
        {isLoading ? (
          <Spinner />
        ) : !topProducts?.length ? (
          <EmptyState icon={Package} message="داده‌ای برای نمایش وجود ندارد" />
        ) : (
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_TOKENS.grid} />
                <XAxis type="number" {...axisProps} tickFormatter={compactAxisNumber} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke={CHART_TOKENS.axis} width={100} />
                <Tooltip content={<ChartTooltip unit="تومان" />} cursor={{ fill: "hsl(var(--primary))", fillOpacity: 0.06 }} />
                <Bar dataKey="revenue" name="درآمد" fill={CHART_TOKENS.primary} radius={[0, 6, 6, 0]} maxBarSize={28} isAnimationActive={animate} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* کالاهای کم‌موجود */}
      <div className="rounded-[1.75rem] border border-border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-sm font-extrabold text-foreground">کالاهای کم‌موجود</h2>
        {!lowStock?.length ? (
          <EmptyState icon={Package} message="همه کالاها موجودی کافی دارند" />
        ) : (
          <div className="space-y-2">
            {lowStock.map((v: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-muted/60 p-3">
                <span className="text-sm font-medium"><EntityLink type="product" id={v.product?.id}>{v.product?.name ?? "نامعلوم"}</EntityLink></span>
                <span className="text-sm font-bold tabular-nums text-destructive-text">{toFaDigits(v.stock_qty)} عدد</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- مالی ---
function FinancialReport({ orgId }: { orgId: string }) {
  const { data: summary } = useQuery({
    queryKey: ["report-financial-summary", orgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("dashboard_summary", { p_org: orgId });
      if (error) throw error;
      return data;
    },
  });

  const { data: accounts } = useQuery({
    queryKey: ["report-accounts", orgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("account_balances").select("name, type, balance").eq("org_id", orgId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const pieData = useMemo(() => {
    if (!accounts?.length) return [];
    return accounts.map((a: any) => ({
      name: a.name,
      value: Math.abs(a.balance ?? 0),
    }));
  }, [accounts]);

  return (
    <div className="space-y-6">
      {/* خلاصه مالی */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[1.5rem] border border-border bg-card p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-2xl font-black tabular-nums text-finance-profit">{formatToman(summary?.cash_total ?? 0)}</div>
          <div className="mt-1 text-xs text-muted-foreground">موجودی صندوق و بانک</div>
        </div>
        <div className="rounded-[1.5rem] border border-border bg-card p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-2xl font-black tabular-nums text-finance-debt">{formatToman(summary?.customers_debt ?? 0)}</div>
          <div className="mt-1 text-xs text-muted-foreground">بدهی مشتریان</div>
        </div>
        <div className="rounded-[1.5rem] border border-border bg-card p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-2xl font-black tabular-nums text-finance-credit">{formatToman(summary?.suppliers_credit ?? 0)}</div>
          <div className="mt-1 text-xs text-muted-foreground">طلب از تأمین‌کنندگان</div>
        </div>
        <div className="rounded-[1.5rem] border border-border bg-card p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-2xl font-black tabular-nums text-warning-onSoft">{formatToman(summary?.inventory_value ?? 0)}</div>
          <div className="mt-1 text-xs text-muted-foreground">ارزش موجودی انبار</div>
        </div>
      </div>

      {/* نمودار دایره‌ای */}
      {pieData.length > 0 && (
        <div className="rounded-[1.75rem] border border-border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-sm font-extrabold text-foreground">توزیع حساب‌ها</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip unit="تومان" />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// --- اشخاص ---
function ContactsReport({ orgId }: { orgId: string }) {
  const { data: contactBalances } = useQuery({
    queryKey: ["report-contact-balances", orgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("contact_balances")
        .select("contact_id, name, type, balance")
        .eq("org_id", orgId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    if (!contactBalances?.length) return { customers: 0, suppliers: 0, totalDebt: 0, totalCredit: 0 };
    const customers = contactBalances.filter((c: any) => c.type === "customer" || c.type === "both").length;
    const suppliers = contactBalances.filter((c: any) => c.type === "supplier" || c.type === "both").length;
    let totalDebt = 0, totalCredit = 0;
    contactBalances.forEach((c: any) => {
      if (c.balance > 0) totalDebt += c.balance;
      else totalCredit += Math.abs(c.balance);
    });
    return { customers, suppliers, totalDebt, totalCredit };
  }, [contactBalances]);

  const pieData = [
    { name: "مشتریان", value: Math.max(stats.customers, 0) },
    { name: "تأمین‌کنندگان", value: Math.max(stats.suppliers, 0) },
  ];

  return (
    <div className="space-y-6">
      {/* آمار */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-[1.5rem] border border-border bg-card p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-2xl font-bold text-primary">{toFaDigits(stats.customers)}</div>
          <div className="mt-1 text-xs text-muted-foreground">مشتریان</div>
        </div>
        <div className="rounded-[1.5rem] border border-border bg-card p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-2xl font-black tabular-nums text-success-onSoft">{toFaDigits(stats.suppliers)}</div>
          <div className="mt-1 text-xs text-muted-foreground">تأمین‌کنندگان</div>
        </div>
        <div className="rounded-[1.5rem] border border-border bg-card p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-2xl font-black tabular-nums text-finance-debt">{formatToman(stats.totalDebt)}</div>
          <div className="mt-1 text-xs text-muted-foreground">کل بدهی</div>
        </div>
        <div className="rounded-[1.5rem] border border-border bg-card p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="text-2xl font-black tabular-nums text-finance-credit">{formatToman(stats.totalCredit)}</div>
          <div className="mt-1 text-xs text-muted-foreground">کل طلب</div>
        </div>
      </div>

      {/* نمودار دایره‌ای */}
      <div className="rounded-[1.75rem] border border-border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-sm font-extrabold text-foreground">توزیع اشخاص</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* لیست اشخاص */}
      <div className="rounded-[1.75rem] border border-border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-sm font-extrabold text-foreground">لیست اشخاص</h2>
        {!contactBalances?.length ? (
          <EmptyState icon={Users} message="شخصی ثبت نشده است" />
        ) : (
          <DataTable
            rows={contactBalances.slice(0, 10)}
            keyExtractor={(c: any) => c.contact_id}
            columns={[
              {
                key: "name",
                header: "نام",
                render: (c: any) => (
                  <div className="flex items-center gap-2">
                    <EntityLink type="contact" id={c.contact_id}>{c.name}</EntityLink>
                    <EntityActionMenu type="contact" id={c.contact_id} label={c.name} />
                  </div>
                ),
              },
              {
                key: "type",
                header: "نوع",
                render: (c: any) => (
                  <Badge tone={c.type === "customer" ? "info" : c.type === "supplier" ? "success" : "primary"}>
                    {c.type === "customer" ? "مشتری" : c.type === "supplier" ? "تأمین‌کننده" : "هر دو"}
                  </Badge>
                ),
              },
              {
                key: "balance",
                header: "مانده",
                align: "left",
                render: (c: any) => (
                  <span className={`font-extrabold tabular-nums ${c.balance > 0 ? "text-finance-debt" : c.balance < 0 ? "text-finance-credit" : "text-muted-foreground"}`}>
                    {c.balance > 0 ? "بدهکار " : c.balance < 0 ? "بستانکار " : ""}
                    {formatToman(Math.abs(c.balance))}
                  </span>
                ),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}



// --- سود و زیان ---
function ProfitReport({ orgId }: { orgId: string }) {
  /* Recharts انیمیشن را در JS اجرا می‌کند؛ CSS سراسری خنثی‌اش نمی‌کند. */
  const animate = useChartAnimation();
  const { data: topProducts, isLoading } = useQuery({
    queryKey: ["report-top-selling", orgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("top_selling_products").select("*").limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: salesByColor } = useQuery({
    queryKey: ["report-sales-color", orgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("sales_by_color").select("*").limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: salesBySize } = useQuery({
    queryKey: ["report-sales-size", orgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("sales_by_size").select("*").limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-[1.75rem] border border-border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-sm font-extrabold text-foreground">فروش بر اساس رنگ</h2>
        {(!salesByColor || !salesByColor.length) ? (
          <EmptyState icon={Package} message="داده‌ای موجود نیست" />
        ) : (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesByColor}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_TOKENS.grid} />
                <XAxis dataKey="color" tick={{ fontSize: 12 }} stroke={CHART_TOKENS.axis} />
                <YAxis tick={{ fontSize: 12 }} stroke={CHART_TOKENS.axis} />
                <Tooltip content={<ChartTooltip unit="عدد" />} cursor={{ fill: "hsl(var(--primary))", fillOpacity: 0.06 }} />
                <Bar dataKey="total_sold_qty" name="تعداد فروش" fill={CHART_TOKENS.success} radius={[6, 6, 0, 0]} maxBarSize={48} isAnimationActive={animate} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-[1.75rem] border border-border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-sm font-extrabold text-foreground">فروش بر اساس سایز</h2>
        {!salesBySize || !salesBySize.length ? (
          <EmptyState icon={Package} message="داده‌ای موجود نیست" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {salesBySize.map((s: any) => (
              <div key={s.size} className="rounded-xl border border-border bg-muted/60 p-4 text-center">
                <div className="text-lg font-bold text-primary">{s.size || "-"}</div>
                <div className="text-2xl font-black tabular-nums text-foreground">{toFaDigits(s.total_sold_qty)}</div>
                <div className="text-xs text-muted-foreground">فروش</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[1.75rem] border border-border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-sm font-extrabold text-foreground">پرفروش‌ترین محصولات</h2>
        {isLoading ? (
          <Spinner />
        ) : !topProducts?.length ? (
          <EmptyState icon={TrendingUp} message="داده‌ای موجود نیست" />
        ) : (
          <DataTable
            rows={topProducts as any[]}
            keyExtractor={(p: any) => p.product_id}
            columns={[
              {
                key: "product",
                header: "محصول",
                render: (p: any) => (
                  <div className="flex items-center gap-2">
                    <EntityLink type="product" id={p.product_id}>{p.product_name}</EntityLink>
                    <EntityActionMenu type="product" id={p.product_id} label={p.product_name} />
                  </div>
                ),
              },
              { key: "qty", header: "تعداد", align: "center", render: (p: any) => <span className="tabular-nums">{toFaDigits(p.total_sold_qty)}</span> },
              { key: "sales", header: "فروش", align: "left", render: (p: any) => <span className="font-bold tabular-nums text-foreground">{formatToman(p.total_sales_amount)}</span> },
              { key: "profit", header: "سود", align: "left", render: (p: any) => <span className="font-bold tabular-nums text-finance-profit">{formatToman(p.total_profit)}</span> },
            ]}
          />
        )}
      </div>
    </div>
  );
}

// --- صفحه اصلی ---
export function ReportsPageContent({ forcedTab }: { forcedTab?: TabId }) {
  const { orgId, loading: orgLoading } = useOrg();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>(forcedTab ?? "sales");

  async function exportExcel() {
    if (!orgId) return;
    const supabase = createClient();
    let rows: Record<string, unknown>[] = [];
    if (activeTab === "sales") {
      const { data, error } = await supabase
        .from("sales")
        .select("invoice_no,date,total,discount,tax,status,customer:contacts(name,phone)")
        .order("date", { ascending: false });
      if (error) { toast({ title: error.message, tone: "error" }); return; }
      /*
        🔴 تاریخ شمسی و مبلغ تومان در خروجی.

        پیش از این `date` خام میلادی («2026-08-05T…») و مبالغ به ریال
        صادر می‌شدند، در حالی که کل برنامه تاریخ شمسی و مبلغ تومان
        نشان می‌دهد. کاربری که خروجی را در اکسل باز می‌کرد، اعدادی
        ده‌برابر و تاریخ‌هایی ناآشنا می‌دید و باید دستی تبدیل می‌کرد.
      */
      rows = (data ?? []).map((s: any) => ({
        "شماره فاکتور": s.invoice_no,
        "تاریخ": toJalali(s.date),
        "مشتری": s.customer?.name ?? "مشتری نقدی",
        "موبایل": s.customer?.phone ?? "",
        "مبلغ کل (تومان)": rialToToman(s.total ?? 0),
        "تخفیف (تومان)": rialToToman(s.discount ?? 0),
        "مالیات (تومان)": rialToToman(s.tax ?? 0),
        "وضعیت": s.status,
      }));
    } else if (activeTab === "products") {
      const { data, error } = await supabase
        .from("product_variants")
        .select("sku,barcode,color,size,stock_qty,purchase_price,sale_price,product:products!inner(name,code)")
        .eq("is_active", true)
        .order("stock_qty");
      if (error) { toast({ title: error.message, tone: "error" }); return; }
      rows = (data ?? []).map((v: any) => ({
        "کالا": v.product?.name,
        "کد": v.product?.code,
        "SKU": v.sku,
        "بارکد": v.barcode,
        "رنگ": v.color,
        "سایز": v.size,
        "موجودی": v.stock_qty,
        "قیمت خرید (تومان)": rialToToman(v.purchase_price ?? 0),
        "قیمت فروش (تومان)": rialToToman(v.sale_price ?? 0),
      }));
    } else if (activeTab === "financial") {
      const { data, error } = await supabase.from("transactions").select("type,amount,date,method,note,contact:contacts(name),account:accounts!transactions_account_id_fkey(name)").order("date", { ascending: false });
      if (error) { toast({ title: error.message, tone: "error" }); return; }
      rows = (data ?? []).map((t: any) => ({
        "نوع": t.type,
        "مبلغ (تومان)": rialToToman(t.amount ?? 0),
        "تاریخ": toJalali(t.date),
        "روش": t.method,
        "طرف حساب": t.contact?.name ?? "",
        "حساب": t.account?.name ?? "",
        "توضیح": t.note ?? "",
      }));
    } else if (activeTab === "contacts") {
      const { data, error } = await supabase.from("contact_balances").select("contact_id,name,type,balance").eq("org_id", orgId);
      if (error) { toast({ title: error.message, tone: "error" }); return; }
      rows = data ?? [];
    } else {
      const { data, error } = await supabase.from("top_selling_products").select("*").limit(200);
      if (error) { toast({ title: error.message, tone: "error" }); return; }
      rows = data ?? [];
    }
    /*
      نام فایل با تاریخ شمسی، هم‌راستا با بقیه‌ی برنامه.

      downloadCsv برای داده‌ی خالی false برمی‌گرداند (پیش از این
      خودش alert می‌زد). پیام از اینجا می‌آید تا با بقیه‌ی برنامه
      یکدست باشد.
    */
    const ok = downloadCsv(`tarazoo-${activeTab}-${todayJalali().replace(/\//g, "-")}.csv`, rows);
    if (!ok) toast({ title: "داده‌ای برای خروجی وجود ندارد.", tone: "warning" });
  }

  // URL params support
  const searchParams = useSearchParams();
  useEffect(() => {
    if (forcedTab) {
      setActiveTab(forcedTab);
      return;
    }
    const tab = searchParams.get("tab");
    if (tab && ["sales", "products", "financial", "contacts", "profit"].includes(tab)) {
      setActiveTab(tab as TabId);
    }
  }, [searchParams, forcedTab]);

  if (orgLoading) return <Spinner label="در حال بارگذاری..." />;
  if (!orgId) return <EmptyState icon={Calendar} message="لطفاً ابتدا وارد شوید" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="گزارش‌ها"
        subtitle="تحلیل عملکرد کسب‌وکار"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={exportExcel} icon={<Download size={15} />}>
              خروجی اکسل
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()} icon={<Download size={15} />}>
              PDF
            </Button>
          </div>
        }
      />

      <div className="overflow-hidden rounded-[1.75rem] border border-primary/20 bg-primary/[0.05] p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-foreground">گزارش‌های جدید در دسترس است</h2>
              <Badge tone="primary">جدید</Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">نمای بدهکاران، سودآوری کالا و فروش روزانه با طراحی تازه و اتصال به پنل‌های جدید.</p>
          </div>
          <Link href="/reports/overview-v2" className="btn-primary shrink-0 text-sm">
            مشاهده
          </Link>
        </div>
      </div>

      {/* تب‌ها */}
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:p-2 sm:shadow-sm">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-ring ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* محتوای تب */}
      {activeTab === "sales" && <SalesReport orgId={orgId} />}
      {activeTab === "products" && <ProductsReport orgId={orgId} />}
      {activeTab === "financial" && <FinancialReport orgId={orgId} />}
      {activeTab === "contacts" && <ContactsReport orgId={orgId} />}
      {activeTab === "profit" && <ProfitReport orgId={orgId} />}
    </div>
  );
}

export default function ReportsPage() {
  return <ReportsPageContent />;
}
