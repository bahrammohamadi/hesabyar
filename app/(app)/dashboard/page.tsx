"use client";

import { useState, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { PageHeader, StatCard, Spinner, Modal } from "@/components/shared/ui";
import { ProductSelector, type SelectableVariant } from "@/components/shared/product-selector";
import { ContactSelector, type SelectableContact } from "@/components/shared/contact-selector";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { PhoneLink } from "@/components/shared/phone-link";
import { formatToman, formatNumber, toFaDigits, rialToToman, tomanToRial, toEnDigits, toJalali } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { DashboardSummary, CartItem } from "@/types/db";
import { logActivity } from "@/lib/utils/activity-log";
import {
  TrendingUp,
  Wallet,
  Package,
  AlertTriangle,
  ShoppingBag,
  Receipt,
  ArrowDownCircle,
  ArrowUpCircle,
  Plus,
  ShoppingCart,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  BarChart3,
  Trash2,
  Loader2,
  X,
  Package2,
  UserPlus,
  ArrowLeftRight,
  CreditCard,
  ChevronRight,
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
import Link from "next/link";

export default function DashboardPage() {
  const { orgId, loading: orgLoading } = useOrg();
  const { openDocument, openEntity } = usePanelManager();
  const [quickSaleOpen, setQuickSaleOpen] = useState(false);
  const [quickExpenseOpen, setQuickExpenseOpen] = useState(false);
  const [quickReceiptOpen, setQuickReceiptOpen] = useState(false);

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

  const { data: recentSales } = useQuery({
    queryKey: ["recent-sales", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("sales")
        .select("id, invoice_no, date, total, customer_id, customer:contacts(name)")
        .eq("status", "confirmed")
        .order("date", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: lowStockItems } = useQuery({
    queryKey: ["dashboard-low-stock", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("product_variants")
        .select("id, color, size, stock_qty, product:products!inner(id, name, low_stock_threshold)")
        .eq("is_active", true)
        .limit(5000);
      return ((data as any[]) ?? [])
        .map((v) => ({
          variant_id: v.id,
          product_id: v.product?.id ?? null,
          product_name: v.product?.name ?? "",
          color: v.color,
          size: v.size,
          stock_qty: v.stock_qty,
          low_stock_threshold: v.product?.low_stock_threshold ?? 0,
        }))
        .filter((v) => v.stock_qty <= v.low_stock_threshold)
        .slice(0, 5);
    },
  });

  if (orgLoading || summaryQuery.isLoading) {
    return <Spinner label="در حال بارگذاری داشبورد..." />;
  }

  const s = summaryQuery.data;

  function openRecentSale(id: string) {
    openDocument("sale", id, { mode: "view", context: "dashboard" });
  }

  function handleRecentSaleClick(event: MouseEvent<HTMLElement>, id: string) {
    if (event.defaultPrevented) return;
    const href = `/sales/${id}`;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    openRecentSale(id);
  }

  function handleRecentSaleAuxClick(event: MouseEvent<HTMLElement>, id: string) {
    if (event.button === 1) {
      event.preventDefault();
      window.open(`/sales/${id}`, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="space-y-5 sm:space-y-8">
      <PageHeader
        title="داشبورد مدیریتی"
        subtitle="مرکز کنترل و تحلیل لحظه‌ای کسب‌وکار"
        action={
          <button onClick={() => setQuickSaleOpen(true)} className="btn-primary shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
            <Plus size={18} />
            <span className="hidden sm:inline">فروش جدید</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded hidden sm:inline">F2</span>
          </button>
        }
      />

      {/* بخش ۱: دسترسی‌های سریع - طراحی جدید */}
      <section className="relative">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-primary rounded-full shadow-sm shadow-primary/20" />
            <div>
              <h2 className="text-[15px] font-extrabold text-slate-800">عملیات سریع</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">دسترسی آنی به پرکاربردترین بخش‌ها</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            آنلاین
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-4">
          <QuickActionButton 
            label="فروش جدید" 
            description="ثبت فاکتور سریع"
            icon={Receipt} 
            color="bg-primary"
            badge="F2"
            onClick={() => setQuickSaleOpen(true)} 
          />
          <QuickActionButton 
            label="خرید کالا" 
            description="ورود موجودی"
            icon={ShoppingCart} 
            color="bg-emerald-600" 
            href="/purchases" 
          />
          <QuickActionButton 
            label="تعدیل انبار" 
            description="اصلاح موجودی"
            icon={ArrowDownToLine} 
            color="bg-blue-600" 
            href="/inventory/adjust" 
          />
          <QuickActionButton 
            label="کالای جدید" 
            description="افزودن محصول"
            icon={Package2} 
            color="bg-slate-600" 
            onClick={() => openEntity("product", undefined, { mode: "create", context: "dashboard", title: "کالای جدید" })} 
          />
          <QuickActionButton 
            label="مشتری جدید" 
            description="ثبت مخاطب"
            icon={UserPlus} 
            color="bg-cyan-600" 
            onClick={() => openEntity("contact", undefined, { mode: "create", context: "dashboard", title: "مشتری جدید" })} 
          />
          <QuickActionButton 
            label="گزارشات" 
            description="تحلیل و آمار"
            icon={BarChart3} 
            color="bg-indigo-600" 
            href="/reports/sales" 
          />
        </div>
      </section>

      {/* بخش ۲: ویجت‌های آماری دسته‌بندی شده */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
        
        {/* ستون اول: مالیات (Finance) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-5 bg-emerald-600 rounded-full" />
            <h2 className="text-sm font-bold text-slate-800">وضعیت مالی</h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <StatCard
              label="موجودی صندوق"
              value={formatToman(s?.cash_total)}
              icon={Wallet}
              trend="neutral"
              color="emerald"
              href="/finance"
            />
            <StatCard
              label="فروش امروز"
              value={formatToman(s?.sales_today)}
              subValue={`${toFaDigits(s?.sales_today_count ?? 0)} فاکتور`}
              icon={TrendingUp}
              trend="up"
              color="primary"
              href="/sales"
            />
            <button 
              onClick={() => setQuickExpenseOpen(true)}
              className="card p-4 text-right hover:bg-rose-50 transition-colors group flex items-center justify-between"
            >
              <div>
                <div className="text-sm text-slate-500">هزینه‌های ماه</div>
                <div className="text-lg font-bold text-slate-800">{formatToman(s?.expenses_month)}</div>
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
              value={formatToman(s?.sales_month)}
              subValue={`سود: ${formatToman(s?.profit_month, false)}`}
              icon={ShoppingBag}
              trend="up"
              color="violet"
              href="/sales"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4 text-right group hover:border-rose-200 transition-colors">
                <div className="text-[11px] text-slate-400 mb-1">طلب مشتریان</div>
                <div className="text-sm font-bold text-rose-600">{formatToman(s?.customers_debt)}</div>
              </div>
              <div className="card p-4 text-right group hover:border-emerald-200 transition-colors">
                <div className="text-[11px] text-slate-400 mb-1">طلب تأمین‌کننده</div>
                <div className="text-sm font-bold text-emerald-600">{formatToman(s?.suppliers_credit)}</div>
              </div>
            </div>
            <div className="card p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => setQuickReceiptOpen(true)}>
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
            <StatCard
              label="ارزش کل انبار"
              value={formatToman(s?.inventory_value)}
              icon={Package}
              trend="neutral"
              color="blue"
              href="/products"
            />
            <div className={`card p-4 border-l-4 ${ (s?.low_stock_count ?? 0) > 0 ? "border-l-rose-400 bg-rose-50/30" : "border-l-slate-200" }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-500">کالاهای کم‌موجود</div>
                  <div className="text-xl font-bold text-slate-800">{toFaDigits(s?.low_stock_count ?? 0)} مورد</div>
                </div>
                <AlertTriangle className={ (s?.low_stock_count ?? 0) > 0 ? "text-amber-500" : "text-slate-300" } size={24} />
              </div>
              {(s?.low_stock_count ?? 0) > 0 && (
                <Link href="/inventory/movements" className="text-xs text-amber-600 font-medium mt-2 inline-block hover:underline">
                  بررسی و سفارش کالا →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* بخش ۳: تحلیلات و لیست‌ها */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* نمودار فروش - فضای بیشتر */}
        <div className="lg:col-span-2 card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp size={20} className="text-primary" />
              روند فروش ۳۰ روز اخیر
            </h3>
            <Link href="/reports" className="text-xs text-primary hover:underline">گزارش تحلیل فروش</Link>
          </div>
          {chartQuery.isLoading ? (
            <Spinner />
          ) : !chartQuery.data || chartQuery.data.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-16">داده‌ای برای نمایش در نمودار یافت نشد.</div>
          ) : (
            <div className="h-56 sm:h-72" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartQuery.data}>
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
                  <Tooltip
                    formatter={(v: number) => [formatNumber(v) + " تومان", "فروش"]}
                    contentStyle={{ fontFamily: "Vazirmatn", fontSize: 12, direction: "rtl", borderRadius: '12px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    fill="url(#salesGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* لیست آخرین فعالیت‌ها / فاکتورها */}
        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Receipt size={20} className="text-primary" />
              آخرین فاکتورها
            </h3>
            <Link href="/sales" className="text-xs text-primary hover:underline">مشاهده همه</Link>
          </div>
          <div className="space-y-3">
            {recentSales && recentSales.length > 0 ? (
              recentSales.map((sale: any) => (
                <div
                  key={sale.id}
                  role="link"
                  tabIndex={0}
                  onClick={(event) => handleRecentSaleClick(event, sale.id)}
                  onAuxClick={(event) => handleRecentSaleAuxClick(event, sale.id)}
                  onKeyDown={(event) => { if (event.key === "Enter") openRecentSale(sale.id); }}
                  className="flex cursor-pointer items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-primary/30"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/sales/${sale.id}`}
                      className="text-sm font-medium block truncate text-primary hover:underline"
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
                        event.preventDefault();
                        event.stopPropagation();
                        openRecentSale(sale.id);
                      }}
                    >
                      {sale.invoice_no}
                    </Link>
                    <div className="text-[11px] text-slate-400">
                      {sale.customer_id ? (
                        <EntityLink type="contact" id={sale.customer_id}>{sale.customer?.name ?? "مشتری"}</EntityLink>
                      ) : "مشتری نقدی"} • {toJalali(sale.date)}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-slate-700 shrink-0">{formatToman(sale.total, false)}</div>
                </div>
              ))
            ) : (
              <div className="text-center text-sm text-slate-400 py-8">فاکتوری یافت نشد.</div>
            )}
          </div>
        </div>
      </div>

      {/* مودال‌ها */}
      {quickSaleOpen && <QuickSaleModal orgId={orgId} onClose={() => setQuickSaleOpen(false)} />}
      {quickExpenseOpen && <QuickTxModal orgId={orgId} type="expense" onClose={() => setQuickExpenseOpen(false)} />}
      {quickReceiptOpen && <QuickTxModal orgId={orgId} type="receipt" onClose={() => setQuickReceiptOpen(false)} />}
    </div>
  );
}

type QuickActionAccent = "primary" | "emerald" | "blue" | "amber" | "rose" | "violet" | "cyan" | "slate";

function QuickActionButton({ 
  label, 
  icon: Icon, 
  color, 
  accent: accentProp,
  onClick, 
  href,
  description,
  badge
}: { 
  label: string; 
  icon: any; 
  color?: string;
  accent?: QuickActionAccent;
  onClick?: () => void; 
  href?: string;
  description?: string;
  badge?: string;
}) {
  // map color string like "bg-primary" to accent name
  const accentMap: Record<string, QuickActionAccent> = {
    "bg-primary": "primary",
    "bg-emerald-600": "emerald",
    "bg-blue-600": "blue",
    "bg-slate-600": "slate",
    "bg-cyan-600": "cyan",
    "bg-indigo-600": "violet",
    "bg-rose-600": "rose",
    "bg-amber-600": "amber",
  };
  const accent: QuickActionAccent = accentProp ?? accentMap[color || ""] ?? "primary";

  const accentStyles: Record<QuickActionAccent, {bg:string;text:string;ring:string;hover:string;shadow:string}> = {
    primary: { bg: "bg-primary/10", text: "text-primary", ring: "ring-primary/20", hover: "hover:bg-primary/10", shadow: "shadow-primary/10" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-200", hover: "hover:bg-emerald-100", shadow: "shadow-emerald-600/10" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-200", hover: "hover:bg-blue-100", shadow: "shadow-blue-600/10" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-200", hover: "hover:bg-amber-100", shadow: "shadow-amber-600/10" },
    rose: { bg: "bg-rose-50", text: "text-rose-600", ring: "ring-rose-200", hover: "hover:bg-rose-100", shadow: "shadow-rose-600/10" },
    violet: { bg: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-200", hover: "hover:bg-violet-100", shadow: "shadow-violet-600/10" },
    cyan: { bg: "bg-cyan-50", text: "text-cyan-600", ring: "ring-cyan-200", hover: "hover:bg-cyan-100", shadow: "shadow-cyan-600/10" },
    slate: { bg: "bg-slate-100", text: "text-slate-700", ring: "ring-slate-200", hover: "hover:bg-slate-200", shadow: "shadow-slate-600/10" },
  };

  const style = accentStyles[accent];

  const content = (
    <div className={cn(
      "relative group w-full rounded-[18px] sm:rounded-[20px] bg-card border border-border p-3 sm:p-4 transition-all duration-200",
      "hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-slate-300",
      "focus:outline-none focus:ring-2 focus:ring-primary/20",
      "text-right"
    )}>
      {/* subtle top accent */}
      <div className={cn("absolute top-0 right-4 left-4 h-[3px] rounded-b-full opacity-60", style.text.replace('text-', 'bg-'))} />
      
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-sm",
          style.bg, style.text, style.shadow
        )}>
          <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="font-extrabold text-[12px] sm:text-[13px] text-slate-800 leading-tight">{label}</div>
          {description && (
            <div className="text-[11px] text-slate-500 mt-1 leading-snug">{description}</div>
          )}
          {badge && (
            <div className={cn("inline-flex mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full", style.bg, style.text)}>
              {badge}
            </div>
          )}
        </div>
      </div>

      {/* chevron hint */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300">
        <ChevronRight size={14} className="rotate-180" />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline">
        {content}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className="w-full text-right">
      {content}
    </button>
  );
}

// ... (The rest of the QuickSaleModal and QuickTxModal remain as they were, but I'll include them for completeness)

function QuickSaleModal({ orgId, onClose }: { orgId: string | null; onClose: () => void }) {
  const { branchId } = useOrg();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<SelectableContact | null>(null);
  const [discount, setDiscount] = useState("0");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [paidCash, setPaidCash] = useState("");
  const [paidCard, setPaidCard] = useState("");
  const [paidWallet, setPaidWallet] = useState("");
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);

  const { data: accounts } = useQuery({
    queryKey: ["quick-sale-accounts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("accounts").select("id, name, type").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: walletCredit } = useQuery({
    queryKey: ["customer-wallet", customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("contacts").select("meta").eq("id", customer!.id).maybeSingle();
      return Number((data?.meta as any)?.wallet_credit ?? 0) || 0;
    },
  });

  function addToCart(v: SelectableVariant) {
    setCart((prev) => {
      const existing = prev.find((c) => c.variant_id === v.variant_id);
      if (existing) return prev.map((c) => c.variant_id === v.variant_id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, {
        variant_id: v.variant_id,
        product_id: v.product_id,
        product_name: v.product_name,
        variant_label: [v.color, v.size].filter(Boolean).join(" / "),
        qty: 1,
        unit_price: v.sale_price,
        discount: 0,
        cost_price: v.purchase_price,
        stock_qty: v.stock_qty,
      }];
    });
  }

  function updateQty(id: string, qty: number) {
    if (qty < 1) { setCart((p) => p.filter((c) => c.variant_id !== id)); return; }
    setCart((p) => p.map((c) => c.variant_id === id ? { ...c, qty } : c));
  }

  function updatePrice(id: string, tomanValue: string) {
    setCart((p) => p.map((c) => c.variant_id === id ? { ...c, unit_price: tomanToRial(Number(toEnDigits(tomanValue)) || 0) } : c));
  }

  const subtotal = cart.reduce((s, c) => s + c.unit_price * c.qty - c.discount, 0);
  const discountInput = Number(toEnDigits(discount)) || 0;
  const discountRial = discountType === "percent" ? Math.round((subtotal * discountInput) / 100) : tomanToRial(discountInput);
  const total = Math.max(0, subtotal - discountRial);
  const paidCashRial = tomanToRial(Number(toEnDigits(paidCash)) || 0);
  const paidCardRial = tomanToRial(Number(toEnDigits(paidCard)) || 0);
  const requestedWalletRial = tomanToRial(Number(toEnDigits(paidWallet)) || 0);
  const paidWalletRial = Math.min(requestedWalletRial, walletCredit ?? 0, Math.max(0, total - paidCashRial - paidCardRial));
  const credit = Math.max(0, total - paidCashRial - paidCardRial - paidWalletRial);

  async function handleSubmit() {
    setError(null);
    if (cart.length === 0) { setError("سبد فروش خالی است."); return; }
    if (credit > 0 && !customer) { setError("برای فروش نسیه باید مشتری انتخاب کنید."); return; }
    if (!orgId) return;
    setSaving(true);
    const supabase = createClient();
    try {
      const { data, error: e } = await supabase.rpc("create_sale", {
        p_org: orgId,
        p_branch: branchId,
        p_customer: customer?.id || null,
        p_items: cart.map((c) => ({ variant_id: c.variant_id, qty: c.qty, unit_price: c.unit_price, discount: c.discount, cost_price: c.cost_price })),
        p_discount: discountRial,
        p_discount_type: discountType,
        p_discount_value: discountType === "percent" ? discountInput : discountRial,
        p_tax: 0,
        p_paid_cash: paidCashRial,
        p_paid_card: paidCardRial,
        p_paid_credit: credit,
        p_account: accountId || null,
        p_note: null,
      });
      if (e) throw e;
      if (paidWalletRial > 0 && customer?.id) {
        const { error: walletError } = await supabase.rpc("spend_customer_wallet", {
          p_contact: customer.id,
          p_sale: data as string,
          p_amount: paidWalletRial,
          p_note: "پرداخت از اعتبار کیف پول در فاکتور فروش",
        });
        if (walletError) throw walletError;
      }
      await logActivity({ orgId, action: "create", entityType: "sale", entityId: data as string, newData: { total, customer_id: customer?.id ?? null, items_count: cart.length, source: "dashboard" } });
      setDone(data as string);
    } catch (e) {
      setError("خطا: " + (e as Error).message);
      setSaving(false);
    }
  }

  if (done) {
    return (
      <Modal open onClose={onClose} title="فروش ثبت شد">
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Receipt size={30} />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">فاکتور با موفقیت ثبت شد ✅</h3>
          <p className="text-sm text-slate-500 mt-2">مبلغ کل: {formatToman(total)}</p>
          <div className="flex gap-2 mt-6">
            <Link href={`/sales/${done}`} className="btn-primary flex-1">مشاهده و چاپ فاکتور</Link>
            <button onClick={onClose} className="btn-secondary">بستن</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal open onClose={onClose} title="فروش جدید" size="lg">
        <div className="space-y-4">
          <div>
            <label className="label">مشتری</label>
            {customer ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5">
                <div>
                  <div className="font-medium text-sm text-slate-800">{customer.name}</div>
                  {customer.phone && <PhoneLink phone={customer.phone} className="text-xs" />}
                </div>
                <button onClick={() => setCustomer(null)} className="text-slate-400 hover:text-rose-500"><X size={18} /></button>
              </div>
            ) : (
              <button onClick={() => setCustomerPickerOpen(true)} className="w-full flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3.5 py-2.5 text-sm text-slate-500 hover:border-primary/30 hover:text-primary">
                <UserPlus size={18} /> انتخاب مشتری (یا مشتری نقدی)
              </button>
            )}
          </div>
          <button onClick={() => setProductPickerOpen(true)} className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/[0.03] hover:bg-primary/[0.06] px-4 py-3.5 text-sm font-bold text-primary transition-colors">
            <Package2 size={18} /> افزودن کالا به فاکتور
          </button>
          {cart.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-6 border border-dashed border-slate-200 rounded-xl">کالایی انتخاب نشده است.</div>
          ) : (
            <div className="space-y-2 max-h-[30vh] overflow-y-auto">
              {cart.map((c) => (
                <div key={c.variant_id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <EntityLink type="product" id={c.product_id} className="truncate text-sm">{c.product_name}</EntityLink>
                        <EntityActionMenu type="product" id={c.product_id} label={c.product_name} />
                      </div>
                      <div className="text-xs text-slate-400">{c.variant_label || "ساده"}</div>
                    </div>
                    <button onClick={() => updateQty(c.variant_id, 0)} className="text-rose-400 hover:text-rose-600 p-1 shrink-0"><Trash2 size={16} /></button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center border border-slate-200 rounded-lg">
                      <button onClick={() => updateQty(c.variant_id, c.qty - 1)} className="px-2.5 py-1 text-slate-500">−</button>
                      <span className="px-3 text-sm font-medium">{toFaDigits(c.qty)}</span>
                      <button onClick={() => updateQty(c.variant_id, c.qty + 1)} className="px-2.5 py-1 text-slate-500">+</button>
                    </div>
                    <input className="input flex-1 text-sm" inputMode="numeric" value={String(rialToToman(c.unit_price))} onChange={(e) => updatePrice(c.variant_id, e.target.value)} />
                    <div className="text-sm font-medium text-slate-700 w-28 text-left shrink-0">{formatToman(c.unit_price * c.qty - c.discount, false)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">حساب</label>
              <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">انتخاب...</option>
                {accounts?.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">تخفیف</label>
              <div className="flex gap-2">
                <input className="input" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                <select className="input w-28" value={discountType} onChange={(e) => setDiscountType(e.target.value as "fixed" | "percent") }>
                  <option value="fixed">تومان</option>
                  <option value="percent">٪</option>
                </select>
              </div>
              {discountRial > 0 && <div className="text-xs text-slate-400 mt-1">معادل تخفیف: {formatToman(discountRial)}</div>}
            </div>
            <div>
              <label className="label">نقدی (تومان)</label>
              <input className="input" inputMode="numeric" value={paidCash} onChange={(e) => setPaidCash(e.target.value)} />
            </div>
            <div>
              <label className="label">کارتی (تومان)</label>
              <input className="input" inputMode="numeric" value={paidCard} onChange={(e) => setPaidCard(e.target.value)} />
            </div>
            {customer && (
              <div>
                <label className="label">اعتبار مشتری (تومان)</label>
                <input className="input" inputMode="numeric" value={paidWallet} onChange={(e) => setPaidWallet(e.target.value)} />
                <div className="text-xs text-slate-400 mt-1">اعتبار موجود: {formatToman(walletCredit ?? 0)}</div>
              </div>
            )}
          </div>
          <div className="rounded-xl bg-slate-50 p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-500"><span>جمع کل</span><span>{formatToman(subtotal)}</span></div>
            {discountRial > 0 && <div className="flex justify-between text-slate-500"><span>تخفیف</span><span>{formatToman(discountRial)}</span></div>}
            <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-200 pt-1.5"><span>مبلغ قابل پرداخت</span><span>{formatToman(total)}</span></div>
            {paidWalletRial > 0 && <div className="flex justify-between text-emerald-600 font-medium"><span>پرداخت از اعتبار</span><span>{formatToman(paidWalletRial)}</span></div>}
            {credit > 0 && <div className="flex justify-between text-rose-600 font-medium"><span>نسیه</span><span>{formatToman(credit)}</span></div>}
          </div>
          {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>}
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
              {saving && <Loader2 className="animate-spin" size={18} />} ثبت فروش
            </button>
            <button onClick={onClose} className="btn-secondary">انصراف</button>
          </div>
        </div>
      </Modal>

      <ProductSelector open={productPickerOpen} onClose={() => setProductPickerOpen(false)} onSelect={addToCart} priceMode="sale" />
      <ContactSelector open={customerPickerOpen} onClose={() => setCustomerPickerOpen(false)} onSelect={(c) => { setCustomer(c); setCustomerPickerOpen(false); }} filterType="customer" title="انتخاب مشتری" />
    </>
  );
}

function QuickTxModal({ orgId, type, onClose }: { orgId: string | null; type: "expense" | "receipt"; onClose: () => void }) {
  const { branchId } = useOrg();
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [contactId, setContactId] = useState("");
  const [expenseCatId, setExpenseCatId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: accounts } = useQuery({
    queryKey: ["quick-tx-accounts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("accounts").select("id, name").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["quick-tx-contacts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("contacts").select("id, name").eq("is_active", true).order("name").limit(200);
      return data ?? [];
    },
  });

  const { data: expCats } = useQuery({
    queryKey: ["quick-exp-cats", orgId],
    enabled: !!orgId && type === "expense",
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("expense_categories").select("id, name").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  async function handleSave() {
    setError(null);
    const amt = tomanToRial(Number(toEnDigits(amount)) || 0);
    if (amt <= 0) { setError("مبلغ را وارد کنید."); return; }
    if (!orgId) return;
    setSaving(true);
    const supabase = createClient();
    try {
      await supabase.from("transactions").insert({
        org_id: orgId,
        branch_id: branchId,
        type,
        amount: amt,
        account_id: accountId || null,
        contact_id: contactId || null,
        expense_category_id: expenseCatId || null,
        method: "cash",
        note: note.trim() || null,
      });
      onClose();
    } catch (e) {
      setError("خطا: " + (e as Error).message);
      setSaving(false);
    }
  }

  const title = type === "expense" ? "ثبت هزینه" : "ثبت دریافتی";

  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-4">
        <div>
          <label className="label">مبلغ (تومان) *</label>
          <input autoFocus className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">حساب</label>
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">انتخاب...</option>
            {accounts?.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {type === "receipt" && (
          <div>
            <label className="label">از</label>
            <select className="input" value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">—</option>
              {contacts?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {type === "expense" && (
          <div>
            <label className="label">دسته هزینه</label>
            <select className="input" value={expenseCatId} onChange={(e) => setExpenseCatId(e.target.value)}>
              <option value="">—</option>
              {expCats?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">توضیحات</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving && <Loader2 className="animate-spin" size={18} />} ثبت
          </button>
          <button onClick={onClose} className="btn-secondary">انصراف</button>
        </div>
      </div>
    </Modal>
  );
}
