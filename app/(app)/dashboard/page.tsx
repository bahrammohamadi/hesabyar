"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { PageHeader, Spinner, Modal } from "@/components/shared/ui";
import { ProductSelector, type SelectableVariant } from "@/components/shared/product-selector";
import { ContactSelector, type SelectableContact } from "@/components/shared/contact-selector";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { PhoneLink } from "@/components/shared/phone-link";
import { formatToman, toFaDigits, rialToToman, tomanToRial, toEnDigits, toJalali } from "@/lib/utils/format";
import type { DashboardSummary, CartItem } from "@/types/db";
import { logActivity } from "@/lib/utils/activity-log";
import Link from "next/link";
import { ArrowUpFromLine, Loader2, Package2, Plus, Receipt, Send, Trash2, UserPlus, X } from "lucide-react";
import {
  DashboardQuickActions,
  DashboardRecentInvoices,
  DashboardSalesChart,
  DashboardStats,
} from "./components";

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
            <span className="hidden rounded bg-white/20 px-1.5 py-0.5 text-[10px] lg:inline">F2</span>
          </button>
        }
      />

      <DashboardQuickActions
        onOpenQuickSale={() => setQuickSaleOpen(true)}
        onCreateProduct={() => openEntity("product", undefined, { mode: "create", context: "dashboard", title: "کالای جدید" })}
        onCreateContact={() => openEntity("contact", undefined, { mode: "create", context: "dashboard", title: "مشتری جدید" })}
      />

      <DashboardStats summary={s} lowStockItems={lowStockItems} onOpenExpense={() => setQuickExpenseOpen(true)} onOpenReceipt={() => setQuickReceiptOpen(true)} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <DashboardSalesChart isLoading={chartQuery.isLoading} data={chartQuery.data} />
        <DashboardRecentInvoices
          sales={recentSales}
          onOpenSale={openRecentSale}
          onSaleClick={handleRecentSaleClick}
          onSaleAuxClick={handleRecentSaleAuxClick}
        />
      </div>

      {/* مودال‌ها */}
      {quickSaleOpen && <QuickSaleModal orgId={orgId} onClose={() => setQuickSaleOpen(false)} />}
      {quickExpenseOpen && <QuickTxModal orgId={orgId} type="expense" onClose={() => setQuickExpenseOpen(false)} />}
      {quickReceiptOpen && <QuickTxModal orgId={orgId} type="receipt" onClose={() => setQuickReceiptOpen(false)} />}
    </div>
  );
}

function QuickSaleModal({ orgId, onClose }: { orgId: string | null; onClose: () => void }) {
  const { branchId } = useOrg();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<SelectableContact | null>(null);
  const [discount, setDiscount] = useState("0");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [paidCash, setPaidCash] = useState("");
  const [paidCard, setPaidCard] = useState("");
  const [paidWallet, setPaidWallet] = useState("");
  const [isCreditSale, setIsCreditSale] = useState(false);
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

  function resetForNextSale() {
    setCart([]);
    setCustomer(null);
    setDiscount("0");
    setDiscountType("fixed");
    setPaidCash("");
    setPaidCard("");
    setPaidWallet("");
    setIsCreditSale(false);
    setAccountId("");
    setSaving(false);
    setError(null);
    setDone(null);
  }

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
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Link href={`/sales/${done}`} className="btn-primary">مشاهده و چاپ فاکتور</Link>
            <button type="button" disabled title="به‌زودی - نیاز به اتصال سرویس پیامک" className="btn-secondary cursor-not-allowed opacity-60"><Send size={16} /> ارسال برای مشتری</button>
            <button onClick={resetForNextSale} className="btn-primary sm:col-span-2">فاکتور جدید</button>
            <button onClick={onClose} className="btn-secondary sm:col-span-2">بستن</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal open onClose={onClose} title="فروش جدید" size="xl">
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
            <div className="max-h-[42vh] overflow-y-auto rounded-2xl border border-slate-100 bg-white">
              <div className="hidden grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_minmax(120px,1fr)_140px_minmax(120px,1fr)_44px] gap-2 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 md:grid">
                <span>کالا</span><span>تنوع/SKU</span><span>قیمت واحد</span><span className="text-center">تعداد</span><span className="text-left">جمع</span><span />
              </div>
              <div className="divide-y divide-slate-100">
                {cart.map((c) => (
                  <div key={c.variant_id} className="p-3">
                    <div className="hidden grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_minmax(120px,1fr)_140px_minmax(120px,1fr)_44px] items-center gap-2 md:grid">
                      <div className="min-w-0"><div className="flex items-center gap-2"><EntityLink type="product" id={c.product_id} className="truncate text-sm font-semibold">{c.product_name}</EntityLink><EntityActionMenu type="product" id={c.product_id} label={c.product_name} /></div></div>
                      <div className="truncate text-xs text-slate-500" title={c.variant_label || "ساده"}>{c.variant_label || "ساده"}</div>
                      <input className="input h-10 min-h-10 text-left text-sm" inputMode="numeric" value={String(rialToToman(c.unit_price))} onChange={(e) => updatePrice(c.variant_id, e.target.value)} />
                      <div className="mx-auto flex h-10 items-center rounded-xl border border-slate-200 bg-white"><button onClick={() => updateQty(c.variant_id, c.qty - 1)} className="px-2.5 text-slate-500">−</button><span className="min-w-8 text-center text-sm font-bold">{toFaDigits(c.qty)}</span><button onClick={() => updateQty(c.variant_id, c.qty + 1)} className="px-2.5 text-slate-500">+</button></div>
                      <div className="text-left text-sm font-black text-slate-800 tabular-nums">{formatToman(c.unit_price * c.qty - c.discount, false)}</div>
                      <button onClick={() => updateQty(c.variant_id, 0)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-rose-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button>
                    </div>
                    <div className="md:hidden"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><EntityLink type="product" id={c.product_id} className="truncate text-sm font-semibold">{c.product_name}</EntityLink><div className="text-xs text-slate-400">{c.variant_label || "ساده"}</div></div><button onClick={() => updateQty(c.variant_id, 0)} className="text-rose-400"><Trash2 size={16} /></button></div><div className="mt-2 flex items-center justify-between gap-2 text-sm"><span>{formatToman(c.unit_price, false)} × {toFaDigits(c.qty)}</span><strong>{formatToman(c.unit_price * c.qty - c.discount, false)}</strong></div></div>
                  </div>
                ))}
              </div>
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
            <label className="col-span-2 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <input type="checkbox" checked={isCreditSale} onChange={(e) => setIsCreditSale(e.target.checked)} />
              این فروش نسیه است / پرداخت خودکار نقدی را غیرفعال کن
            </label>
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
