"use client";

import { useState, useMemo, type MouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { PageHeader, Spinner, Modal } from "@/components/shared/ui";
import { ProductSelector, type SelectableVariant } from "@/components/shared/product-selector";
import { ContactSelector, type SelectableContact } from "@/components/shared/contact-selector";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { PhoneLink } from "@/components/shared/phone-link";
import { formatToman, toFaDigits, toEnDigits, rialToToman, tomanToRial, toJalali } from "@/lib/utils/format";
import { Plus, Trash2, Receipt, Loader2, ShoppingCart, Package, UserPlus, X } from "lucide-react";
import type { CartItem } from "@/types/db";
import { logActivity } from "@/lib/utils/activity-log";
import Link from "next/link";

export default function SalesPage() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const { openDocument } = usePanelManager();
  const [posOpen, setPosOpen] = useState(false);

  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales-list", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sales")
        .select("id, invoice_no, date, total, paid_credit, status, customer_id, customer:contacts(name)")
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as {
        id: string;
        invoice_no: string;
        date: string;
        total: number;
        paid_credit: number;
        status: string;
        customer_id: string | null;
        customer: { name: string } | null;
      }[];
    },
  });

  function openSale(id: string) {
    openDocument("sale", id, { mode: "view", context: "workspace" });
  }

  function handleSaleRowClick(event: MouseEvent<HTMLElement>, id: string) {
    if (event.defaultPrevented) return;
    const href = `/sales/${id}`;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    openSale(id);
  }

  function handleSaleRowAuxClick(event: MouseEvent<HTMLElement>, id: string) {
    if (event.button === 1) {
      event.preventDefault();
      window.open(`/sales/${id}`, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div>
      <PageHeader
        title="فروش"
        subtitle="صدور فاکتور و مدیریت فروش"
        action={
          <button onClick={() => setPosOpen(true)} className="btn-primary">
            <Plus size={18} />
            <span className="hidden sm:inline">فروش جدید</span>
          </button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : !sales || sales.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/[0.06] text-primary flex items-center justify-center mx-auto mb-4">
            <ShoppingCart size={26} />
          </div>
          <h3 className="font-semibold text-slate-700">هنوز فروشی ثبت نشده</h3>
          <p className="text-sm text-slate-400 mt-1">اولین فاکتور فروش خود را صادر کنید.</p>
          <button onClick={() => setPosOpen(true)} className="btn-primary mt-4 mx-auto">
            <Plus size={18} /> فروش جدید
          </button>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>شماره فاکتور</th>
                <th>تاریخ</th>
                <th>مشتری</th>
                <th>مبلغ</th>
                <th>نسیه</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr
                  key={s.id}
                  role="link"
                  tabIndex={0}
                  onClick={(event) => handleSaleRowClick(event, s.id)}
                  onAuxClick={(event) => handleSaleRowAuxClick(event, s.id)}
                  onKeyDown={(event) => { if (event.key === "Enter") openSale(s.id); }}
                  className="cursor-pointer odd:bg-white even:bg-slate-50/60 transition hover:bg-primary/[0.06] hover:shadow-sm"
                >
                  <td>
                    <Link
                      href={`/sales/${s.id}`}
                      className="font-medium text-primary hover:underline"
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
                        event.preventDefault();
                        event.stopPropagation();
                        openSale(s.id);
                      }}
                    >
                      {s.invoice_no}
                    </Link>
                  </td>
                  <td className="text-slate-500">{toJalali(s.date)}</td>
                  <td>
                    {s.customer_id ? (
                      <div className="flex items-center gap-2">
                        <EntityLink type="contact" id={s.customer_id}>{s.customer?.name ?? "مشتری"}</EntityLink>
                        <span onClick={(event) => event.stopPropagation()}><EntityActionMenu type="contact" id={s.customer_id} label={s.customer?.name ?? "مشتری"} /></span>
                      </div>
                    ) : (
                      <span className="text-slate-400">مشتری نقدی</span>
                    )}
                  </td>
                  <td className="text-left font-semibold tabular-nums">{formatToman(s.total)}</td>
                  <td>
                    {s.paid_credit > 0 ? (
                      <span className="text-rose-600">{formatToman(s.paid_credit, false)}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td>
                    <span className="badge bg-info-soft text-info border border-info/20">{s.status === "settled" ? "تسویه‌شده" : s.status === "reversed" ? "برگشت‌خورده" : "ثبت‌شده"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {posOpen && (
        <PosModal
          orgId={orgId}
          onClose={() => {
            setPosOpen(false);
            qc.invalidateQueries({ queryKey: ["sales-list"] });
            qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
          }}
        />
      )}
    </div>
  );
}

function PosModal({ orgId, onClose }: { orgId: string | null; onClose: () => void }) {
  const { branchId } = useOrg();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<SelectableContact | null>(null);
  const [discount, setDiscount] = useState("0");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [paidCash, setPaidCash] = useState("");
  const [paidCard, setPaidCard] = useState("");
  const [paidWallet, setPaidWallet] = useState("");
  const [accountId, setAccountId] = useState("");
  const [priceListId, setPriceListId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);

  const { data: accounts } = useQuery({
    queryKey: ["sale-accounts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("accounts")
        .select("id, name, type")
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const { data: priceLists } = useQuery({
    queryKey: ["sale-price-lists", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("price_lists").select("id,name,discount_percent,type").eq("is_active", true).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const selectedPriceList = priceLists?.find((list: any) => list.id === priceListId) ?? null;

  const { data: priceListItems } = useQuery({
    queryKey: ["sale-price-list-items", priceListId],
    enabled: !!priceListId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("price_list_items").select("variant_id,price").eq("price_list_id", priceListId);
      return data ?? [];
    },
  });

  function priceForVariant(v: SelectableVariant) {
    const explicit = priceListItems?.find((item: any) => item.variant_id === v.variant_id)?.price;
    if (typeof explicit === "number") return explicit;
    const percent = Number(selectedPriceList?.discount_percent ?? 0);
    return Math.max(0, Math.round(v.sale_price * (100 - percent) / 100));
  }

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
      if (existing) {
        return prev.map((c) => (c.variant_id === v.variant_id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [
        ...prev,
        {
          variant_id: v.variant_id,
          product_id: v.product_id,
          product_name: v.product_name,
          variant_label: [v.color, v.size].filter(Boolean).join(" / "),
          qty: 1,
          unit_price: priceForVariant(v),
          discount: 0,
          cost_price: v.purchase_price,
          stock_qty: v.stock_qty,
        },
      ];
    });
    // پنجره باز می‌ماند تا کاربر چند کالا پشت‌سرهم اضافه کند
  }

  function updateQty(id: string, qty: number) {
    if (qty < 1) {
      setCart((p) => p.filter((c) => c.variant_id !== id));
      return;
    }
    setCart((p) => p.map((c) => (c.variant_id === id ? { ...c, qty } : c)));
  }

  function updatePrice(id: string, tomanValue: string) {
    const rial = tomanToRial(Number(toEnDigits(tomanValue)) || 0);
    setCart((p) => p.map((c) => (c.variant_id === id ? { ...c, unit_price: rial } : c)));
  }

  const subtotal = useMemo(() => cart.reduce((s, c) => s + c.unit_price * c.qty - c.discount, 0), [cart]);
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
    if (cart.length === 0) {
      setError("سبد فروش خالی است.");
      return;
    }
    if (credit > 0 && !customer) {
      setError("برای فروش نسیه باید مشتری انتخاب کنید.");
      return;
    }
    if (!orgId) return;
    setSaving(true);
    const supabase = createClient();
    try {
      const { data, error: e } = await supabase.rpc("create_sale", {
        p_org: orgId,
        p_branch: branchId,
        p_customer: customer?.id || null,
        p_items: cart.map((c) => ({
          variant_id: c.variant_id,
          qty: c.qty,
          unit_price: c.unit_price,
          discount: c.discount,
          cost_price: c.cost_price,
        })),
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
      await logActivity({ orgId, action: "create", entityType: "sale", entityId: data as string, newData: { total, customer_id: customer?.id ?? null, items_count: cart.length } });
      setDone(data as string);
    } catch (e) {
      setError("خطا در ثبت فروش: " + (e as Error).message);
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
            <Link href={`/sales/${done}`} className="btn-primary flex-1">
              مشاهده و چاپ فاکتور
            </Link>
            <button onClick={onClose} className="btn-secondary">
              بستن
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal open onClose={onClose} title="فروش جدید" size="xl">
        <div className="space-y-4">
          {/* انتخاب مشتری */}
          <div>
            <label className="label">مشتری</label>
            {customer ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5">
                <div>
                  <div className="font-medium text-sm text-slate-800">{customer.name}</div>
                  {customer.phone && <PhoneLink phone={customer.phone} className="text-xs" />}
                </div>
                <button onClick={() => setCustomer(null)} className="text-slate-400 hover:text-rose-500">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCustomerPickerOpen(true)}
                className="w-full flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3.5 py-2.5 text-sm text-slate-500 hover:border-primary/30 hover:text-primary"
              >
                <UserPlus size={18} />
                انتخاب مشتری (یا مشتری نقدی)
              </button>
            )}
          </div>

          <div>
            <label className="label">لیست قیمت</label>
            <select className="input" value={priceListId} onChange={(e) => setPriceListId(e.target.value)}>
              <option value="">قیمت عادی کالا</option>
              {priceLists?.map((list: any) => <option key={list.id} value={list.id}>{list.name} {list.discount_percent ? `(${list.discount_percent}٪)` : ""}</option>)}
            </select>
          </div>

          {/* دکمه افزودن کالا */}
          <button
            onClick={() => setProductPickerOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm font-medium text-primary hover:bg-primary/[0.06]"
          >
            <Package size={18} />
            افزودن کالا به فاکتور
          </button>

          {/* سبد */}
          {cart.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-6 border border-dashed border-slate-200 rounded-xl">
              کالایی انتخاب نشده است.
            </div>
          ) : (
            <div className="max-h-[42vh] overflow-y-auto rounded-2xl border border-slate-100 bg-white">
              <div className="hidden grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_minmax(120px,1fr)_140px_minmax(120px,1fr)_44px] gap-2 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 md:grid">
                <span>کالا</span><span>تنوع/SKU</span><span>قیمت واحد</span><span className="text-center">تعداد</span><span className="text-left">جمع</span><span />
              </div>
              <div className="divide-y divide-slate-100">
                {cart.map((c) => (
                  <div key={c.variant_id} className="p-3">
                    <div className="hidden grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_minmax(120px,1fr)_140px_minmax(120px,1fr)_44px] items-center gap-2 md:grid">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <EntityLink type="product" id={c.product_id} className="truncate text-sm font-semibold">{c.product_name}</EntityLink>
                          <EntityActionMenu type="product" id={c.product_id} label={c.product_name} />
                        </div>
                      </div>
                      <div className="truncate text-xs text-slate-500" title={c.variant_label || "ساده"}>{c.variant_label || "ساده"}</div>
                      <input className="input h-10 min-h-10 text-left text-sm" inputMode="numeric" value={String(rialToToman(c.unit_price))} onChange={(e) => updatePrice(c.variant_id, e.target.value)} />
                      <div className="mx-auto flex h-10 items-center rounded-xl border border-slate-200 bg-white">
                        <button onClick={() => updateQty(c.variant_id, c.qty - 1)} className="px-2.5 text-slate-500">−</button>
                        <span className="min-w-8 text-center text-sm font-bold">{toFaDigits(c.qty)}</span>
                        <button onClick={() => updateQty(c.variant_id, c.qty + 1)} className="px-2.5 text-slate-500">+</button>
                      </div>
                      <div className="text-left text-sm font-black text-slate-800 tabular-nums">{formatToman(c.unit_price * c.qty - c.discount, false)}</div>
                      <button onClick={() => updateQty(c.variant_id, 0)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-rose-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button>
                    </div>
                    <div className="md:hidden">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0"><EntityLink type="product" id={c.product_id} className="truncate text-sm font-semibold">{c.product_name}</EntityLink><div className="text-xs text-slate-400">{c.variant_label || "ساده"}</div></div>
                        <button onClick={() => updateQty(c.variant_id, 0)} className="text-rose-400"><Trash2 size={16} /></button>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-sm"><span>{formatToman(c.unit_price, false)} × {toFaDigits(c.qty)}</span><strong>{formatToman(c.unit_price * c.qty - c.discount, false)}</strong></div>
                    </div>
                    {c.qty > c.stock_qty && <div className="mt-2 text-xs text-amber-600">⚠ موجودی کافی نیست (موجودی: {toFaDigits(c.stock_qty)})</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* پرداخت */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <div>
              <label className="label">حساب دریافت وجه</label>
              <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">انتخاب...</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
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
              <label className="label">دریافت نقدی (تومان)</label>
              <input className="input" inputMode="numeric" value={paidCash} onChange={(e) => setPaidCash(e.target.value)} />
            </div>
            <div>
              <label className="label">دریافت کارتی (تومان)</label>
              <input className="input" inputMode="numeric" value={paidCard} onChange={(e) => setPaidCard(e.target.value)} />
            </div>
            {customer && (
              <div>
                <label className="label">پرداخت از اعتبار مشتری (تومان)</label>
                <input className="input" inputMode="numeric" value={paidWallet} onChange={(e) => setPaidWallet(e.target.value)} />
                <div className="text-xs text-slate-400 mt-1">اعتبار موجود: {formatToman(walletCredit ?? 0)}</div>
              </div>
            )}
          </div>

          {/* جمع */}
          <div className="rounded-xl bg-slate-50 p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>جمع کل</span>
              <span>{formatToman(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>تخفیف</span>
              <span>{formatToman(discountRial)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-200 pt-1.5">
              <span>مبلغ قابل پرداخت</span>
              <span>{formatToman(total)}</span>
            </div>
            {paidWalletRial > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium"><span>پرداخت از اعتبار</span><span>{formatToman(paidWalletRial)}</span></div>
            )}
            {credit > 0 && (
              <div className="flex justify-between text-rose-600 font-medium">
                <span>باقیمانده (نسیه)</span>
                <span>{formatToman(credit)}</span>
              </div>
            )}
          </div>

          {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>}

          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
              {saving && <Loader2 className="animate-spin" size={18} />}
              ثبت فروش
            </button>
            <button onClick={onClose} className="btn-secondary">انصراف</button>
          </div>
        </div>
      </Modal>

      <ProductSelector
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        onSelect={(v) => addToCart(v)}
        priceMode="sale"
      />
      <ContactSelector
        open={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={(c) => {
          setCustomer(c);
          setCustomerPickerOpen(false);
        }}
        filterType="customer"
        title="انتخاب مشتری"
      />
    </>
  );
}
