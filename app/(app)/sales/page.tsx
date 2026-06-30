"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
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
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4">
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
                <tr key={s.id} className="hover:bg-slate-50">
                  <td>
                    <EntityLink type="sale" id={s.id}>{s.invoice_no}</EntityLink>
                  </td>
                  <td className="text-slate-500">{toJalali(s.date)}</td>
                  <td>
                    {s.customer_id ? (
                      <div className="flex items-center gap-2">
                        <EntityLink type="contact" id={s.customer_id}>{s.customer?.name ?? "مشتری"}</EntityLink>
                        <EntityActionMenu type="contact" id={s.customer_id} label={s.customer?.name ?? "مشتری"} />
                      </div>
                    ) : (
                      <span className="text-slate-400">مشتری نقدی</span>
                    )}
                  </td>
                  <td className="font-medium">{formatToman(s.total)}</td>
                  <td>
                    {s.paid_credit > 0 ? (
                      <span className="text-rose-600">{formatToman(s.paid_credit, false)}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td>
                    <span className="badge bg-emerald-100 text-emerald-700">ثبت‌شده</span>
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
  const [accountId, setAccountId] = useState("");
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
          unit_price: v.sale_price,
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
  const credit = Math.max(0, total - paidCashRial - paidCardRial);

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
      <Modal open onClose={onClose} title="فروش جدید" size="lg">
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
                className="w-full flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3.5 py-2.5 text-sm text-slate-500 hover:border-brand-300 hover:text-brand-600"
              >
                <UserPlus size={18} />
                انتخاب مشتری (یا مشتری نقدی)
              </button>
            )}
          </div>

          {/* دکمه افزودن کالا */}
          <button
            onClick={() => setProductPickerOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-4 py-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
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
            <div className="space-y-2">
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
                    <button
                      onClick={() => updateQty(c.variant_id, 0)}
                      className="text-rose-400 hover:text-rose-600 p-1 shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center border border-slate-200 rounded-lg">
                      <button onClick={() => updateQty(c.variant_id, c.qty - 1)} className="px-2.5 py-1 text-slate-500">−</button>
                      <span className="px-3 text-sm font-medium">{toFaDigits(c.qty)}</span>
                      <button onClick={() => updateQty(c.variant_id, c.qty + 1)} className="px-2.5 py-1 text-slate-500">+</button>
                    </div>
                    <input
                      className="input flex-1 text-sm"
                      inputMode="numeric"
                      value={String(rialToToman(c.unit_price))}
                      onChange={(e) => updatePrice(c.variant_id, e.target.value)}
                    />
                    <div className="text-sm font-medium text-slate-700 w-28 text-left shrink-0">
                      {formatToman(c.unit_price * c.qty - c.discount, false)}
                    </div>
                  </div>
                  {c.qty > c.stock_qty && (
                    <div className="text-xs text-amber-600 mt-1">
                      ⚠ موجودی کافی نیست (موجودی: {toFaDigits(c.stock_qty)})
                    </div>
                  )}
                </div>
              ))}
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
