"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { formatToman, formatNumber, toFaDigits } from "@/lib/utils/format";
import { toJalali } from "@/lib/utils/format";
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

type TabId = "sales" | "products" | "financial" | "contacts";

const TABS: { id: TabId; label: string; icon: typeof TrendingUp }[] = [
  { id: "sales", label: "فروش", icon: TrendingUp },
  { id: "products", label: "محصولات", icon: Package },
  { id: "financial", label: "مالی", icon: Wallet },
  { id: "contacts", label: "اشخاص", icon: Users },
];

const COLORS = ["#1d60f2", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

// --- فروش ---
function SalesReport({ orgId }: { orgId: string }) {
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
    <div className="space-y-6">
      {/* خلاصه آمار */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-brand-600">{formatToman(summary?.sales_today ?? 0)}</div>
          <div className="text-xs text-slate-500 mt-1">فروش امروز</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{formatToman(summary?.sales_month ?? 0)}</div>
          <div className="text-xs text-slate-500 mt-1">فروش ماه</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-slate-600">{toFaDigits(summary?.sales_today_count ?? 0)}</div>
          <div className="text-xs text-slate-500 mt-1">فاکتور امروز</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{formatToman(summary?.profit_month ?? 0)}</div>
          <div className="text-xs text-slate-500 mt-1">سود ماه</div>
        </div>
      </div>

      {/* انتخاب بازه زمانی */}
      <div className="flex gap-2">
        {(["7d", "30d", "90d", "1y"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              period === p ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {p === "7d" ? "۷ روز" : p === "30d" ? "۳۰ روز" : p === "90d" ? "۹۰ روز" : "یک سال"}
          </button>
        ))}
      </div>

      {/* نمودار */}
      <div className="card p-4 sm:p-6">
        <h3 className="font-semibold text-slate-800 mb-4">نمودار فروش</h3>
        {isLoading ? (
          <Spinner />
        ) : !chartData?.length ? (
          <EmptyState icon={TrendingUp} message="داده‌ای برای نمایش وجود ندارد" />
        ) : (
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="#94a3b8"
                  tickFormatter={(v) => (v >= 1000000 ? `${v / 1000000}M` : `${v / 1000}k`)}
                />
                <Tooltip
                  formatter={(v: number) => [formatNumber(v * 10) + " تومان", "فروش"]}
                  contentStyle={{ fontFamily: "Vazirmatn", fontSize: 12, direction: "rtl" }}
                />
                <Line type="monotone" dataKey="فروش" stroke="#1d60f2" strokeWidth={2} dot={{ r: 3 }} />
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
  const { data: topProducts, isLoading } = useQuery({
    queryKey: ["report-top-products", orgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sale_items")
        .select(`
          quantity,
          unit_price,
          product:products!inner(name)
        `)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      if (error) throw error;

      const totals: Record<string, { name: string; revenue: number; qty: number }> = {};
      (data ?? []).forEach((item: any) => {
        const name = item.product?.name ?? "نامعلوم";
        if (!totals[name]) totals[name] = { name, revenue: 0, qty: 0 };
        totals[name].revenue += (item.quantity ?? 0) * (item.unit_price ?? 0);
        totals[name].qty += item.quantity ?? 0;
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
        .select(`stock_qty, product:products!inner(name)`)
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
      <div className="card p-4 sm:p-6">
        <h3 className="font-semibold text-slate-800 mb-4">پرفروش‌ترین محصولات (۳۰ روز)</h3>
        {isLoading ? (
          <Spinner />
        ) : !topProducts?.length ? (
          <EmptyState icon={Package} message="داده‌ای برای نمایش وجود ندارد" />
        ) : (
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `${v / 1000000}M`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} stroke="#94a3b8" width={100} />
                <Tooltip
                  formatter={(v: number) => [formatNumber(v) + " تومان", "درآمد"]}
                  contentStyle={{ fontFamily: "Vazirmatn", fontSize: 12, direction: "rtl" }}
                />
                <Bar dataKey="revenue" fill="#1d60f2" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* کالاهای کم‌موجود */}
      <div className="card p-4 sm:p-6">
        <h3 className="font-semibold text-slate-800 mb-4">کالاهای کم‌موجود</h3>
        {!lowStock?.length ? (
          <EmptyState icon={Package} message="همه کالاها موجودی کافی دارند" />
        ) : (
          <div className="space-y-2">
            {lowStock.map((v: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm font-medium">{v.product?.name ?? "نامعلوم"}</span>
                <span className="text-sm font-bold text-rose-600">{toFaDigits(v.stock_qty)} عدد</span>
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
      const { data, error } = await supabase.from("accounts").select("name, type, balance").eq("org_id", orgId);
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
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{formatToman(summary?.cash_total ?? 0)}</div>
          <div className="text-xs text-slate-500 mt-1">موجودی صندوق و بانک</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-slate-600">{formatToman(summary?.customers_debt ?? 0)}</div>
          <div className="text-xs text-slate-500 mt-1">بدهی مشتریان</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-rose-600">{formatToman(summary?.suppliers_credit ?? 0)}</div>
          <div className="text-xs text-slate-500 mt-1">طلب از تأمین‌کنندگان</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{formatToman(summary?.inventory_value ?? 0)}</div>
          <div className="text-xs text-slate-500 mt-1">ارزش موجودی انبار</div>
        </div>
      </div>

      {/* نمودار دایره‌ای */}
      {pieData.length > 0 && (
        <div className="card p-4 sm:p-6">
          <h3 className="font-semibold text-slate-800 mb-4">توزیع حساب‌ها</h3>
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
                <Tooltip formatter={(v: number) => [formatNumber(v) + " تومان", "موجودی"]} />
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
  const { data: contacts } = useQuery({
    queryKey: ["report-contacts", orgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, type, balance, phone")
        .eq("org_id", orgId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    if (!contacts?.length) return { customers: 0, suppliers: 0, totalDebt: 0, totalCredit: 0 };
    const customers = contacts.filter((c: any) => c.type === "customer").length;
    const suppliers = contacts.filter((c: any) => c.type === "supplier").length;
    let totalDebt = 0, totalCredit = 0;
    contacts.forEach((c: any) => {
      if (c.balance > 0) totalDebt += c.balance;
      else totalCredit += Math.abs(c.balance);
    });
    return { customers, suppliers, totalDebt, totalCredit };
  }, [contacts]);

  const pieData = [
    { name: "مشتریان", value: stats.customers },
    { name: "تأمین‌کنندگان", value: stats.suppliers },
  ];

  return (
    <div className="space-y-6">
      {/* آمار */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-brand-600">{toFaDigits(stats.customers)}</div>
          <div className="text-xs text-slate-500 mt-1">مشتریان</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{toFaDigits(stats.suppliers)}</div>
          <div className="text-xs text-slate-500 mt-1">تأمین‌کنندگان</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-rose-600">{formatToman(stats.totalDebt)}</div>
          <div className="text-xs text-slate-500 mt-1">کل بدهی</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{formatToman(stats.totalCredit)}</div>
          <div className="text-xs text-slate-500 mt-1">کل طلب</div>
        </div>
      </div>

      {/* نمودار دایره‌ای */}
      <div className="card p-4 sm:p-6">
        <h3 className="font-semibold text-slate-800 mb-4">توزیع اشخاص</h3>
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
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* لیست اشخاص */}
      <div className="card p-4 sm:p-6">
        <h3 className="font-semibold text-slate-800 mb-4">لیست اشخاص</h3>
        {!contacts?.length ? (
          <EmptyState icon={Users} message="شخصی ثبت نشده است" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-right py-2 px-3 font-medium text-slate-500">نام</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-500">نوع</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-500">موجودی</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-500">تلفن</th>
                </tr>
              </thead>
              <tbody>
                {contacts.slice(0, 10).map((c: any) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium">{c.name}</td>
                    <td className="py-2 px-3">
                      <span className={`badge ${c.type === "customer" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {c.type === "customer" ? "مشتری" : "تأمین‌کننده"}
                      </span>
                    </td>
                    <td className={`py-2 px-3 ${c.balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {formatToman(c.balance)}
                    </td>
                    <td className="py-2 px-3 text-slate-500">{c.phone || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// --- صفحه اصلی ---
export default function ReportsPage() {
  const { orgId, loading: orgLoading } = useOrg();
  const [activeTab, setActiveTab] = useState<TabId>("sales");

  if (orgLoading) return <Spinner label="در حال بارگذاری..." />;
  if (!orgId) return <EmptyState icon={Calendar} message="لطفاً ابتدا وارد شوید" />;

  return (
    <div>
      <PageHeader
        title="گزارش‌ها"
        subtitle="تحلیل عملکرد کسب‌وکار"
        action={
          <button className="btn btn-secondary flex items-center gap-2 text-sm">
            <Download size={16} />
            خروجی PDF
          </button>
        }
      />

      {/* تب‌ها */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-4 px-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                activeTab === tab.id
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
    </div>
  );
}