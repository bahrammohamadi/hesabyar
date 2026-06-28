"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, StatCard, Spinner, Modal } from "@/components/shared/ui";
import { ProductSelector, type SelectableVariant } from "@/components/shared/product-selector";
import { ContactSelector, type SelectableContact } from "@/components/shared/contact-selector";
import { formatToman, formatNumber, toFaDigits, rialToToman, tomanToRial, toEnDigits } from "@/lib/utils/format";
import type { DashboardSummary, CartItem } from "@/types/db";
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
import Link from "next/link";

export default function DashboardPage() {
  const { orgId, loading: orgLoading } = useOrg();
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

  // Recent sales for quick view
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

  // Low stock items
  const { data: lowStockItems } = useQuery({
    queryKey: ["dashboard-low-stock", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("low_stock_variants")
        .select("variant_id, product_name, color, size, stock_qty")
        .limit(5);
      return data ?? [];
    },
  });

  if (orgLoading || summaryQuery.isLoading) {
    return <Spinner label="در حال بارگذاری داشبورد..." />;
  }

  const s = summaryQuery.data;

  return (
    <div>
      <PageHeader
        title="داشبورد مدیریتی"
        subtitle="مرکز کنترل روزانه فروشگاه"
        action={
          <button onClick={() => setQuickSaleOpen(true)} className="btn-primary">
            <Plus size={18} />
            <span className="hidden sm:inline">فروش جدید</span>
          </button>
        }
      />

      {/* دکمه‌های دسترسی سریع */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-slate-500 mb-3">دسترسی سریع</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          <button
            onClick={() => setQuickSaleOpen(true)}
            className="card p-3 flex flex-col items-center gap-2 hover:bg-brand-50 transition group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center">
              <Receipt size={20} />
            </div>
            <span className="text-xs font-medium text-slate-700 group-hover:text-brand-700">فروش جدید</span>
          </button>
          <Link href="/purchases" className="card p-3 flex flex-col items-center gap-2 hover:bg-emerald-50 transition group no-underline">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <ShoppingCart size={20} />
            </div>
            <span className="text-xs font-medium text-slate-700 group-hover:text-emerald-700">خرید جدید</span>
          </Link>
          <Link href="/inventory" className="card p-3 flex flex-col items-center gap-2 hover:bg-blue-50 transition group no-underline">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <ArrowDownToLine size={20} />
            </div>
            <span className="text-xs font-medium text-slate-700 group-hover:text-blue-700">تعدیل انبار</span>
          </Link>
          <button
            onClick={() => setQuickExpenseOpen(true)}
            className="card p-3 flex flex-col items-center gap-2 hover:bg-rose-50 transition group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center">
              <ArrowUpCircle size={20} />
            </div>
            <span className="text-xs font-medium text-slate-700 group-hover:text-rose-700">ثبت هزینه</span>
          </button>
          <button
            onClick={() => setQuickReceiptOpen(true)}
            className="card p-3 flex flex-col items-center gap-2 hover:bg-amber-50 transition group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center">
              <ArrowDownCircle size={20} />
            </div>
            <span className="text-xs font-medium text-slate-700 group-hover:text-amber-700">ثبت دریافتی</span>
          </button>
          <Link href="/products" className="card p-3 flex flex-col items-center gap-2 hover:bg-slate-100 transition group no-underline">
            <div className="w-10 h-10 rounded-xl bg-slate-600 text-white flex items-center justify-center">
              <Plus size={20} />
            </div>
            <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">افزودن کالا</span>
          </Link>
          <Link href="/contacts" className="card p-3 flex flex-col items-center gap-2 hover:bg-cyan-50 transition group no-underline">
            <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center">
              <Users size={20} />
            </div>
            <span className="text-xs font-medium text-slate-700 group-hover:text-cyan-700">افزودن شخص</span>
          </Link>
          <Link href="/reports" className="card p-3 flex flex-col items-center gap-2 hover:bg-indigo-50 transition group no-underline">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <BarChart3 size={20} />
            </div>
            <span className="text-xs font-medium text-slate-700 group-hover:text-indigo-700">گزارش‌ها</span>
          </Link>
        </div>
      </div>

      {/* کارت‌های آماری (کلیک‌پذیر) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Link href="/sales" className="card p-4 sm:p-5 hover:shadow-md transition group block no-underline">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">فروش امروز</span>
            <span className="text-slate-400 group-hover:text-brand-600 transition-colors"><Receipt size={20} /></span>
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold text-slate-800">{formatToman(s?.sales_today)}</div>
          <div className="mt-1 text-xs text-slate-400">{toFaDigits(s?.sales_today_count ?? 0)} فاکتور</div>
        </Link>
        <Link href="/sales" className="card p-4 sm:p-5 hover:shadow-md transition group block no-underline">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">فروش این ماه</span>
            <span className="text-slate-400 group-hover:text-emerald-600 transition-colors"><TrendingUp size={20} /></span>
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold text-slate-800">{formatToman(s?.sales_month)}</div>
          <div className="mt-1 text-xs text-emerald-600">سود: {formatToman(s?.profit_month, false)}</div>
        </Link>
        <button onClick={() => setQuickExpenseOpen(true)} className="card p-4 sm:p-5 hover:shadow-md transition group cursor-pointer text-right">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">هزینه‌های ماه</span>
            <span className="text-slate-400 group-hover:text-rose-600 transition-colors"><ArrowUpCircle size={20} /></span>
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold text-slate-800">{formatToman(s?.expenses_month)}</div>
          <div className="mt-1 text-xs text-slate-400">تراکنش‌های مالی</div>
        </button>
        <Link href="/finance" className="card p-4 sm:p-5 hover:shadow-md transition group block no-underline">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">موجودی صندوق</span>
            <span className="text-slate-400 group-hover:text-brand-600 transition-colors"><Wallet size={20} /></span>
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold text-slate-800">{formatToman(s?.cash_total)}</div>
          <div className="mt-1 text-xs text-slate-400">نقد و بانک</div>
        </Link>
        <Link href="/products" className="card p-4 sm:p-5 hover:shadow-md transition group block no-underline">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">ارزش انبار</span>
            <span className="text-slate-400 group-hover:text-cyan-600 transition-colors"><Package size={20} /></span>
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold text-slate-800">{formatToman(s?.inventory_value)}</div>
          <div className="mt-1 text-xs text-slate-400">موجودی کل</div>
        </Link>
        <Link href="/inventory" className={`card p-4 sm:p-5 hover:shadow-md transition group block no-underline ${(s?.low_stock_count ?? 0) > 0 ? "border-amber-200 bg-amber-50/30" : ""}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">کالاهای کم‌موجود</span>
            <span className={`${(s?.low_stock_count ?? 0) > 0 ? "text-amber-500" : "text-slate-400 group-hover:text-amber-600"} transition-colors`}>
              <AlertTriangle size={20} />
            </span>
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold text-slate-800">{toFaDigits(s?.low_stock_count ?? 0)}</div>
          <div className="mt-1 text-xs text-amber-600">نیازمند بررسی</div>
        </Link>
        <Link href="/contacts" className="card p-4 sm:p-5 hover:shadow-md transition group block no-underline">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">بدهی مشتریان</span>
            <span className="text-slate-400 group-hover:text-rose-600 transition-colors"><ArrowDownCircle size={20} /></span>
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold text-rose-600">{formatToman(s?.customers_debt)}</div>
          <div className="mt-1 text-xs text-slate-400">طلب از مشتریان</div>
        </Link>
        <Link href="/contacts" className="card p-4 sm:p-5 hover:shadow-md transition group block no-underline">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">طلب تامین‌کننده</span>
            <span className="text-slate-400 group-hover:text-emerald-600 transition-colors"><ArrowUpCircle size={20} /></span>
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold text-emerald-600">{formatToman(s?.suppliers_credit)}</div>
          <div className="mt-1 text-xs text-slate-400">حساب تامین‌کنندگان</div>
        </Link>
      </div>

      {/* بخش پایین: نمودار + سایدبارها */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* نمودار فروش */}
        <div className="lg:col-span-2 card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp size={18} className="text-brand-500" />
              نمودار فروش ۳۰ روز اخیر
            </h2>
            <Link href="/reports" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
              گزارش کامل →
            </Link>
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

        {/* سایدبار: کالاهای کم موجود + آخرین فروش‌ها */}
        <div className="space-y-4">
          {/* کالاهای کم موجود */}
          {lowStockItems && lowStockItems.length > 0 && (
            <div className="card p-4 border-amber-200 bg-amber-50/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-amber-700 flex items-center gap-2 text-sm">
                  <AlertTriangle size={16} />
                  کالاهای کم‌موجود
                </h3>
                <Link href="/inventory" className="text-xs text-amber-600 hover:text-amber-700">
                  مشاهده همه →
                </Link>
              </div>
              <div className="space-y-2">
                {lowStockItems.map((v: any) => (
                  <div key={v.variant_id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 truncate flex-1">
                      {v.product_name}
                      {v.color || v.size ? (
                        <span className="text-slate-400 text-xs mr-1">
                          ({[v.color, v.size].filter(Boolean).join(" / ")})
                        </span>
                      ) : null}
                    </span>
                    <span className="text-amber-600 font-medium shrink-0 mr-2">
                      {toFaDigits(v.stock_qty)} عدد
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* آخرین فاکتورها */}
          {recentSales && recentSales.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                  <Receipt size={16} className="text-brand-500" />
                  آخرین فاکتورها
                </h3>
                <Link href="/sales" className="text-xs text-brand-600 hover:text-brand-700">
                  مشاهده همه →
                </Link>
              </div>
              <div className="space-y-2">
                {recentSales.map((sale: any) => (
                  <Link
                    key={sale.id}
                    href={`/sales/${sale.id}`}
                    className="flex items-center justify-between text-sm hover:bg-slate-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors block no-underline"
                  >
                    <div>
                      <div className="font-medium text-brand-600">{sale.invoice_no}</div>
                      <div className="text-xs text-slate-400">
                        {sale.customer_id ? <Link href={`/contacts/${sale.customer_id}`} className="hover:underline">{sale.customer?.name ?? "مشتری"}</Link> : <span className="text-slate-400">مشتری نقدی</span>} • {toJalali(sale.date)}
                      </div>
                    </div>
                    <span className="font-medium text-slate-700">{formatToman(sale.total, false)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* مودال فروش سریع */}
      {quickSaleOpen && (
        <QuickSaleModal
          orgId={orgId}
          onClose={() => setQuickSaleOpen(false)}
        />
      )}

      {/* مودال ثبت هزینه سریع */}
      {quickExpenseOpen && (
        <QuickTxModal
          orgId={orgId}
          type="expense"
          onClose={() => setQuickExpenseOpen(false)}
        />
      )}

      {/* مودال ثبت دریافتی سریع */}
      {quickReceiptOpen && (
        <QuickTxModal
          orgId={orgId}
          type="receipt"
          onClose={() => setQuickReceiptOpen(false)}
        />
      )}
    </div>
  );
}

// ==============================================================
// مودال فروش سریع از داشبورد
// ==============================================================
function QuickSaleModal({ orgId, onClose }: { orgId: string | null; onClose: () => void }) {
  const { branchId } = useOrg();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<SelectableContact | null>(null);
  const [discount, setDiscount] = useState("0");
  const [paidCash, setPaidCash] = useState("");
  const [paidCard, setPaidCard] = useState("");
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

  function addToCart(v: SelectableVariant) {
    setCart((prev) => {
      const existing = prev.find((c) => c.variant_id === v.variant_id);
      if (existing) return prev.map((c) => c.variant_id === v.variant_id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, {
        variant_id: v.variant_id,
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
  const discountRial = tomanToRial(Number(toEnDigits(discount)) || 0);
  const total = Math.max(0, subtotal - discountRial);
  const paidCashRial = tomanToRial(Number(toEnDigits(paidCash)) || 0);
  const paidCardRial = tomanToRial(Number(toEnDigits(paidCard)) || 0);
  const credit = Math.max(0, total - paidCashRial - paidCardRial);

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
        p_tax: 0,
        p_paid_cash: paidCashRial,
        p_paid_card: paidCardRial,
        p_paid_credit: credit,
        p_account: accountId || null,
        p_note: null,
      });
      if (e) throw e;
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
                  {customer.phone && <div className="text-xs text-slate-400" dir="ltr">{customer.phone}</div>}
                </div>
                <button onClick={() => setCustomer(null)} className="text-slate-400 hover:text-rose-500"><X size={18} /></button>
              </div>
            ) : (
              <button onClick={() => setCustomerPickerOpen(true)} className="w-full flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3.5 py-2.5 text-sm text-slate-500 hover:border-brand-300 hover:text-brand-600">
                <UserPlus size={18} /> انتخاب مشتری (یا مشتری نقدی)
              </button>
            )}
          </div>
          <button onClick={() => setProductPickerOpen(true)} className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-4 py-3 text-sm font-medium text-brand-700 hover:bg-brand-50">
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
                      <div className="font-medium text-sm text-slate-800 truncate">{c.product_name}</div>
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
              <label className="label">تخفیف (تومان)</label>
              <input className="input" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div>
              <label className="label">نقدی (تومان)</label>
              <input className="input" inputMode="numeric" value={paidCash} onChange={(e) => setPaidCash(e.target.value)} />
            </div>
            <div>
              <label className="label">کارتی (تومان)</label>
              <input className="input" inputMode="numeric" value={paidCard} onChange={(e) => setPaidCard(e.target.value)} />
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-500"><span>جمع کل</span><span>{formatToman(subtotal)}</span></div>
            {discountRial > 0 && <div className="flex justify-between text-slate-500"><span>تخفیف</span><span>{formatToman(discountRial)}</span></div>}
            <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-200 pt-1.5"><span>مبلغ قابل پرداخت</span><span>{formatToman(total)}</span></div>
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

// ==============================================================
// مودال ثبت تراکنش سریع (هزینه / دریافت)
// ==============================================================
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
  const iconColor = type === "expense" ? "text-rose-600" : "text-emerald-600";

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