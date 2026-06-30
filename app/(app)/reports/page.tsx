"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
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

type TabId = "sales" | "products" | "financial" | "contacts" | "profit";

const TABS: { id: TabId; label: string; icon: typeof TrendingUp }[] = [
  { id: "sales", label: "فروش", icon: TrendingUp },
  { id: "products", label: "محصولات", icon: Package },
  { id: "financial", label: "مالی", icon: Wallet },
  { id: "contacts", label: "اشخاص", icon: Users },
  { id: "profit", label: "سود و زیان", icon: TrendingUp },
];

const COLORS = ["#1d60f2", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    alert("داده‌ای برای خروجی وجود ندارد.");
    return;
  }
  const headers = Object.keys(rows[0]);
  const csv = "﻿" + [headers.map(csvEscape).join(","), ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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
                <span className="text-sm font-medium"><EntityLink type="product" id={v.product?.id}>{v.product?.name ?? "نامعلوم"}</EntityLink></span>
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
        {!contactBalances?.length ? (
          <EmptyState icon={Users} message="شخصی ثبت نشده است" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-right py-2 px-3 font-medium text-slate-500">نام</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-500">نوع</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-500">مانده</th>
                </tr>
              </thead>
              <tbody>
                {contactBalances.slice(0, 10).map((c: any) => (
                  <tr key={c.contact_id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium">
                      <div className="flex items-center gap-2">
                        <EntityLink type="contact" id={c.contact_id}>{c.name}</EntityLink>
                        <EntityActionMenu type="contact" id={c.contact_id} label={c.name} />
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`badge ${c.type === "customer" ? "bg-blue-100 text-blue-700" : c.type === "supplier" ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"}`}>
                        {c.type === "customer" ? "مشتری" : c.type === "supplier" ? "تأمین‌کننده" : "هر دو"}
                      </span>
                    </td>
                    <td className={`py-2 px-3 ${c.balance > 0 ? "text-rose-600" : c.balance < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                      {c.balance > 0 ? "بدهکار " : c.balance < 0 ? "بستانکار " : ""}{formatToman(Math.abs(c.balance))}
                    </td>
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



// --- سود و زیان ---
function ProfitReport({ orgId }: { orgId: string }) {
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
      <div className="card p-4 sm:p-6">
        <h3 className="font-semibold text-slate-800 mb-4">فروش بر اساس رنگ</h3>
        {(!salesByColor || !salesByColor.length) ? (
          <EmptyState icon={Package} message="داده‌ای موجود نیست" />
        ) : (
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesByColor}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="color" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip formatter={(v: number) => [toFaDigits(v) + " عدد", "تعداد فروش"]} contentStyle={{ fontFamily: "Vazirmatn", fontSize: 12, direction: "rtl" }} />
                <Bar dataKey="total_sold_qty" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card p-4 sm:p-6">
        <h3 className="font-semibold text-slate-800 mb-4">فروش بر اساس سایز</h3>
        {!salesBySize || !salesBySize.length ? (
          <EmptyState icon={Package} message="داده‌ای موجود نیست" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {salesBySize.map((s: any) => (
              <div key={s.size} className="p-4 bg-slate-50 rounded-xl text-center">
                <div className="text-lg font-bold text-brand-600">{s.size || "-"}</div>
                <div className="text-2xl font-bold text-slate-800">{toFaDigits(s.total_sold_qty)}</div>
                <div className="text-xs text-slate-500">فروش</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-4 sm:p-6">
        <h3 className="font-semibold text-slate-800 mb-4">پرفروش‌ترین محصولات</h3>
        {isLoading ? (
          <Spinner />
        ) : !topProducts?.length ? (
          <EmptyState icon={TrendingUp} message="داده‌ای موجود نیست" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-right py-2 px-3 font-medium text-slate-500">محصول</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-500">تعداد</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-500">فروش</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-500">سود</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p: any) => (
                  <tr key={p.product_id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium">
                      <div className="flex items-center gap-2">
                        <EntityLink type="product" id={p.product_id}>{p.product_name}</EntityLink>
                        <EntityActionMenu type="product" id={p.product_id} label={p.product_name} />
                      </div>
                    </td>
                    <td className="py-2 px-3">{toFaDigits(p.total_sold_qty)}</td>
                    <td className="py-2 px-3 text-brand-600">{formatToman(p.total_sales_amount)}</td>
                    <td className="py-2 px-3 text-emerald-600">{formatToman(p.total_profit)}</td>
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
export function ReportsPageContent({ forcedTab }: { forcedTab?: TabId }) {
  const { orgId, loading: orgLoading } = useOrg();
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
      if (error) { alert(error.message); return; }
      rows = (data ?? []).map((s: any) => ({ invoice_no: s.invoice_no, date: s.date, customer: s.customer?.name ?? "مشتری نقدی", phone: s.customer?.phone ?? "", total: s.total, discount: s.discount, tax: s.tax, status: s.status }));
    } else if (activeTab === "products") {
      const { data, error } = await supabase
        .from("product_variants")
        .select("sku,barcode,color,size,stock_qty,purchase_price,sale_price,product:products!inner(name,code)")
        .eq("is_active", true)
        .order("stock_qty");
      if (error) { alert(error.message); return; }
      rows = (data ?? []).map((v: any) => ({ product: v.product?.name, code: v.product?.code, sku: v.sku, barcode: v.barcode, color: v.color, size: v.size, stock_qty: v.stock_qty, purchase_price: v.purchase_price, sale_price: v.sale_price }));
    } else if (activeTab === "financial") {
      const { data, error } = await supabase.from("transactions").select("type,amount,date,method,note,contact:contacts(name),account:accounts!transactions_account_id_fkey(name)").order("date", { ascending: false });
      if (error) { alert(error.message); return; }
      rows = (data ?? []).map((t: any) => ({ type: t.type, amount: t.amount, date: t.date, method: t.method, contact: t.contact?.name ?? "", account: t.account?.name ?? "", note: t.note ?? "" }));
    } else if (activeTab === "contacts") {
      const { data, error } = await supabase.from("contact_balances").select("contact_id,name,type,balance").eq("org_id", orgId);
      if (error) { alert(error.message); return; }
      rows = data ?? [];
    } else {
      const { data, error } = await supabase.from("top_selling_products").select("*").limit(200);
      if (error) { alert(error.message); return; }
      rows = data ?? [];
    }
    downloadCsv(`hesabyar-${activeTab}-${new Date().toISOString().slice(0,10)}.csv`, rows);
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
    <div>
      <PageHeader
        title="گزارش‌ها"
        subtitle="تحلیل عملکرد کسب‌وکار"
        action={
          <div className="flex gap-2">
            <button onClick={exportExcel} className="btn-secondary flex items-center gap-2 text-sm">
              <Download size={16} />
              Excel
            </button>
            <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2 text-sm">
              <Download size={16} />
              PDF
            </button>
          </div>
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
      {activeTab === "profit" && <ProfitReport orgId={orgId} />}
    </div>
  );
}

export default function ReportsPage() {
  return <ReportsPageContent />;
}
