"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Calendar, CreditCard, Loader2, Package, Pencil, Plus, Printer, ShoppingCart, Trash2, Truck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState, Modal, Spinner } from "@/components/shared/ui";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { EntityLink } from "@/components/shared/entity-link";
import { formatToman, rialToToman, toFaDigits, toJalali, toEnDigits, tomanToRial } from "@/lib/utils/format";
import { ProductSelector, type SelectableVariant } from "@/components/shared/product-selector";
import { ContactSelector, type SelectableContact } from "@/components/shared/contact-selector";

export default function PurchaseDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const qc = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["purchase-detail", id],
    queryFn: async () => {
      const supabase = createClient();
      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .select(
          `*, supplier:contacts(id, name, phone, code),
           purchase_items(id, qty, unit_price, line_total,
             variant:product_variants(id, color, size, sku, barcode, product:products(id, name, code)))`
        )
        .eq("id", id)
        .single();
      if (purchaseError) throw purchaseError;

      const [{ data: txs }, { data: movements }, { data: paymentSummary }] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, type, amount, date, method, note, account:accounts!transactions_account_id_fkey(name)")
          .eq("purchase_id", id)
          .order("date", { ascending: false }),
        supabase
          .from("stock_movements")
          .select("id, type, reason, qty, created_at, variant_id")
          .eq("ref_table", "purchases")
          .eq("ref_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("purchase_payment_summary")
          .select("paid_total, balance, last_payment_at, payment_count")
          .eq("purchase_id", id)
          .maybeSingle(),
      ]);

      return { purchase: purchase as any, txs: txs ?? [], movements: movements ?? [], paymentSummary };
    },
  });

  if (isLoading) return <Spinner label="در حال بارگذاری خرید..." />;
  if (error) return <EmptyState title="خطا در بارگذاری خرید" description={(error as Error).message} />;
  if (!data?.purchase) return <EmptyState title="خرید یافت نشد" />;

  const purchase = data.purchase;
  const items = purchase.purchase_items ?? [];
  const paid = data.paymentSummary?.paid_total ?? purchase.paid ?? 0;
  const remaining = data.paymentSummary?.balance ?? Math.max(0, (purchase.total ?? 0) - paid);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4 no-print">
        <Link href="/purchases" className="flex items-center gap-1 text-slate-500 text-sm hover:text-brand-600">
          <ArrowRight size={18} /> بازگشت به خریدها
        </Link>
        <div className="flex items-center gap-2">
          {purchase.status !== "cancelled" && <button onClick={() => setEditOpen(true)} className="btn-secondary flex items-center gap-2"><Pencil size={16} /> ویرایش خرید</button>}
          {purchase.status !== "cancelled" && <button onClick={() => setCancelOpen(true)} className="btn-secondary text-rose-600 flex items-center gap-2"><X size={16} /> ابطال</button>}
          {remaining > 0 && purchase.status !== "cancelled" && <button onClick={() => setPaymentOpen(true)} className="btn-secondary flex items-center gap-2"><Plus size={16} /> ثبت پرداخت</button>}
          <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
            <Printer size={18} /> چاپ
          </button>
        </div>
      </div>

      <div className="card p-5 sm:p-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShoppingCart size={26} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800">فاکتور خرید {purchase.invoice_no ?? "—"}</h1>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1"><Calendar size={14} /> {toJalali(purchase.date)}</span>
                <span className="badge bg-slate-100 text-slate-600">{purchase.status === "confirmed" ? "ثبت‌شده" : purchase.status ?? "—"}</span>
              </div>
            </div>
          </div>
          <div className="text-left shrink-0">
            <div className="text-xl font-bold text-slate-800">{formatToman(purchase.total)}</div>
            <div className="text-xs text-slate-400">مبلغ کل</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-400 mb-1">تأمین‌کننده</div>
            {purchase.supplier_id ? (
              <div className="flex items-center gap-2">
                <Truck size={15} className="text-slate-400" />
                <EntityLink type="contact" id={purchase.supplier_id}>{purchase.supplier?.name ?? "تأمین‌کننده"}</EntityLink>
                <EntityActionMenu type="contact" id={purchase.supplier_id} label={purchase.supplier?.name ?? "تأمین‌کننده"} phone={purchase.supplier?.phone} />
              </div>
            ) : <span className="text-slate-400">—</span>}
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
            <div className="text-xs opacity-70 mb-1">پرداخت‌شده</div>
            <div className="font-bold">{formatToman(paid, false)}</div>
          </div>
          <div className="rounded-xl bg-rose-50 p-3 text-rose-700">
            <div className="text-xs opacity-70 mb-1">باقی‌مانده</div>
            <div className="font-bold">{formatToman(remaining, false)}</div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden mb-4">
        <div className="p-4 border-b border-slate-100 font-semibold text-slate-700 flex items-center gap-2">
          <Package size={16} /> آیتم‌های خرید ({toFaDigits(items.length)})
        </div>
        {items.length === 0 ? <EmptyState title="آیتمی ثبت نشده" /> : (
          <div className="divide-y divide-slate-100">
            {items.map((item: any) => (
              <div key={item.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <EntityLink type="product" id={item.variant?.product?.id}>{item.variant?.product?.name ?? "کالا"}</EntityLink>
                    <EntityActionMenu type="product" id={item.variant?.product?.id} label={item.variant?.product?.name ?? "کالا"} />
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {[item.variant?.color, item.variant?.size].filter(Boolean).join(" / ") || item.variant?.sku || item.variant?.barcode || "تنوع ساده"}
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <div className="text-sm font-medium text-slate-800">{toFaDigits(item.qty)} × {formatToman(item.unit_price, false)}</div>
                  <div className="text-sm font-bold text-emerald-600">{formatToman(item.line_total, false)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><CreditCard size={16} /> پرداخت‌ها</h2>
          {data.txs.length === 0 ? <div className="text-sm text-slate-400">پرداختی ثبت نشده است.</div> : (
            <div className="space-y-2">
              {data.txs.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm">
                  <span>{tx.note ?? (tx.type === "payment" ? "پرداخت" : "تراکنش")}</span>
                  <span className="font-medium">{formatToman(tx.amount, false)} • {toJalali(tx.date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4">
          <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><Package size={16} /> تاریخچه انبار</h2>
          {data.movements.length === 0 ? <div className="text-sm text-slate-400">حرکت انباری ثبت نشده است.</div> : (
            <div className="space-y-2">
              {data.movements.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm">
                  <span>{m.reason === "purchase" ? "ورود خرید" : m.reason}</span>
                  <span className={m.qty >= 0 ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>{m.qty >= 0 ? "+" : ""}{toFaDigits(m.qty)} • {toJalali(m.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {purchase.note && <div className="card p-4 mt-4 text-sm text-slate-600"><span className="text-slate-400">توضیح:</span> {purchase.note}</div>}

      {editOpen && (
        <EditPurchaseModal
          purchase={purchase}
          supplier={purchase.supplier}
          items={items}
          onClose={() => {
            setEditOpen(false);
            qc.invalidateQueries({ queryKey: ["purchase-detail", id] });
          }}
        />
      )}

      {cancelOpen && (
        <CancelPurchaseModal
          purchaseId={id}
          invoiceNo={purchase.invoice_no}
          onClose={() => {
            setCancelOpen(false);
            qc.invalidateQueries({ queryKey: ["purchase-detail", id] });
          }}
        />
      )}

      {paymentOpen && (
        <PurchasePaymentModal
          purchaseId={id}
          balance={remaining}
          onClose={() => {
            setPaymentOpen(false);
            qc.invalidateQueries({ queryKey: ["purchase-detail", id] });
            qc.invalidateQueries({ queryKey: ["entity", "contact"] });
          }}
        />
      )}
    </div>
  );
}


type EditPurchaseItem = {
  variant_id: string;
  product_id: string | null;
  product_name: string;
  variant_label: string;
  qty: number;
  unit_price: number;
  sale_price: number;
};

function EditPurchaseModal({ purchase, supplier, items, onClose }: { purchase: any; supplier: any | null; items: any[]; onClose: () => void }) {
  const [date, setDate] = useState(String(purchase.date ?? "").slice(0, 10));
  const [selectedSupplier, setSelectedSupplier] = useState<SelectableContact | null>(supplier ? { id: purchase.supplier_id, name: supplier.name, phone: supplier.phone ?? null, type: "supplier" as any } : null);
  const [cart, setCart] = useState<EditPurchaseItem[]>(items.map((item: any) => ({
    variant_id: item.variant_id,
    product_id: item.variant?.product?.id ?? null,
    product_name: item.variant?.product?.name ?? "کالا",
    variant_label: [item.variant?.color, item.variant?.size].filter(Boolean).join(" / "),
    qty: item.qty,
    unit_price: item.unit_price,
    sale_price: item.variant?.sale_price ?? item.unit_price,
  })));
  const [discountType, setDiscountType] = useState<"fixed" | "percent">((purchase.discount_type === "percent" ? "percent" : "fixed") as any);
  const [discountValue, setDiscountValue] = useState(String(purchase.discount_type === "percent" ? (purchase.discount_value ?? 0) : rialToToman(purchase.discount ?? 0)));
  const [tax, setTax] = useState(String(rialToToman(purchase.tax ?? 0)));
  const [extraTotal, setExtraTotal] = useState(String(rialToToman(purchase.extra_total ?? 0)));
  const [note, setNote] = useState(purchase.note ?? "");
  const [productOpen, setProductOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.qty, 0);
  const discountInput = Number(toEnDigits(discountValue)) || 0;
  const discountRial = discountType === "percent" ? Math.round((subtotal * discountInput) / 100) : tomanToRial(discountInput);
  const taxRial = tomanToRial(Number(toEnDigits(tax)) || 0);
  const extraRial = tomanToRial(Number(toEnDigits(extraTotal)) || 0);
  const total = Math.max(0, subtotal + extraRial - discountRial + taxRial);

  function addProduct(v: SelectableVariant) {
    setCart((prev) => {
      const existing = prev.find((item) => item.variant_id === v.variant_id);
      if (existing) return prev.map((item) => item.variant_id === v.variant_id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { variant_id: v.variant_id, product_id: v.product_id, product_name: v.product_name, variant_label: [v.color, v.size].filter(Boolean).join(" / "), qty: 1, unit_price: v.purchase_price, sale_price: v.sale_price }];
    });
  }

  async function save() {
    setError(null);
    if (cart.length === 0) { setError("خرید باید حداقل یک کالا داشته باشد."); return; }
    setSaving(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("update_purchase_invoice", {
        p_purchase: purchase.id,
        p_supplier: selectedSupplier?.id ?? null,
        p_date: date ? new Date(`${date}T12:00:00`).toISOString() : purchase.date,
        p_items: cart.map((item) => ({ variant_id: item.variant_id, qty: item.qty, unit_price: item.unit_price, sale_price: item.sale_price })),
        p_discount_type: discountType,
        p_discount_value: discountType === "percent" ? discountInput : discountRial,
        p_discount: discountRial,
        p_tax: taxRial,
        p_extra_total: extraRial,
        p_note: note.trim() || null,
      });
      if (error) throw error;
      onClose();
    } catch (e) { setError("خطا در ویرایش خرید: " + (e as Error).message); setSaving(false); }
  }

  return (
    <>
      <Modal open onClose={onClose} title="ویرایش فاکتور خرید" size="lg" mobileFullscreen>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">تاریخ خرید</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label className="label">تأمین‌کننده</label>{selectedSupplier ? <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5"><span>{selectedSupplier.name}</span><button onClick={() => setSelectedSupplier(null)} className="text-rose-500"><X size={16}/></button></div> : <button onClick={() => setSupplierOpen(true)} className="btn-secondary w-full">انتخاب تأمین‌کننده</button>}</div>
          </div>
          <button onClick={() => setProductOpen(true)} className="w-full rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-4 py-3 text-sm font-medium text-brand-700">+ افزودن کالا</button>
          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {cart.map((item) => (
              <div key={item.variant_id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-2"><div><div className="font-medium text-sm">{item.product_name}</div><div className="text-xs text-slate-400">{item.variant_label || "ساده"}</div></div><button onClick={() => setCart((prev) => prev.filter((x) => x.variant_id !== item.variant_id))} className="text-rose-500"><Trash2 size={16}/></button></div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div><label className="text-xs text-slate-400">تعداد</label><input className="input" inputMode="numeric" value={String(item.qty)} onChange={(e) => setCart((prev) => prev.map((x) => x.variant_id === item.variant_id ? { ...x, qty: Number(toEnDigits(e.target.value)) || 1 } : x))} /></div>
                  <div><label className="text-xs text-slate-400">قیمت خرید</label><input className="input" inputMode="numeric" value={String(rialToToman(item.unit_price))} onChange={(e) => setCart((prev) => prev.map((x) => x.variant_id === item.variant_id ? { ...x, unit_price: tomanToRial(Number(toEnDigits(e.target.value)) || 0) } : x))} /></div>
                  <div><label className="text-xs text-slate-400">قیمت فروش</label><input className="input" inputMode="numeric" value={String(rialToToman(item.sale_price))} onChange={(e) => setCart((prev) => prev.map((x) => x.variant_id === item.variant_id ? { ...x, sale_price: tomanToRial(Number(toEnDigits(e.target.value)) || 0) } : x))} /></div>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-t border-slate-100 pt-4">
            <div><label className="label">هزینه اضافه</label><input className="input" inputMode="numeric" value={extraTotal} onChange={(e) => setExtraTotal(e.target.value)} /></div>
            <div><label className="label">تخفیف</label><div className="flex gap-2"><input className="input" inputMode="numeric" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} /><select className="input w-24" value={discountType} onChange={(e) => setDiscountType(e.target.value as any)}><option value="fixed">تومان</option><option value="percent">٪</option></select></div></div>
            <div><label className="label">مالیات</label><input className="input" inputMode="numeric" value={tax} onChange={(e) => setTax(e.target.value)} /></div>
            <div><label className="label">جمع نهایی</label><div className="rounded-xl bg-slate-50 px-3.5 py-2.5 font-bold text-slate-800">{formatToman(total)}</div></div>
          </div>
          <div><label className="label">توضیح</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm p-3">{error}</div>}
          <div className="flex gap-2"><button onClick={save} disabled={saving} className="btn-primary flex-1">{saving && <Loader2 className="animate-spin" size={16}/>} ذخیره تغییرات</button><button onClick={onClose} className="btn-secondary">انصراف</button></div>
        </div>
      </Modal>
      <ProductSelector open={productOpen} onClose={() => setProductOpen(false)} onSelect={(v) => { addProduct(v); setProductOpen(false); }} priceMode="purchase" />
      <ContactSelector open={supplierOpen} onClose={() => setSupplierOpen(false)} onSelect={(c) => { setSelectedSupplier(c); setSupplierOpen(false); }} filterType="supplier" title="انتخاب تأمین‌کننده" />
    </>
  );
}

function CancelPurchaseModal({ purchaseId, invoiceNo, onClose }: { purchaseId: string; invoiceNo?: string | null; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function cancel() {
    setSaving(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("cancel_purchase", { p_purchase: purchaseId, p_reason: reason.trim() || "ابطال از صفحه خرید" });
      if (error) throw error;
      onClose();
    } catch (e) { setError("خطا در ابطال: " + (e as Error).message); setSaving(false); }
  }
  return <Modal open onClose={onClose} title="ابطال فاکتور خرید" size="md"><div className="space-y-4"><div className="rounded-xl bg-rose-50 text-rose-700 p-3 text-sm">خرید {invoiceNo ?? ""} باطل می‌شود؛ موجودی کالاها و پرداخت‌ها خنثی می‌شوند.</div><div><label className="label">دلیل ابطال</label><textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>{error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm p-3">{error}</div>}<div className="flex gap-2"><button onClick={cancel} disabled={saving} className="btn-danger flex-1">{saving && <Loader2 className="animate-spin" size={16}/>} ابطال خرید</button><button onClick={onClose} className="btn-secondary">انصراف</button></div></div></Modal>;
}

function PurchasePaymentModal({ purchaseId, balance, onClose }: { purchaseId: string; balance: number; onClose: () => void }) {
  const [amount, setAmount] = useState(String(Math.round(balance / 10)));
  const [method, setMethod] = useState("cash");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: accounts } = useQuery({
    queryKey: ["purchase-payment-accounts"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("accounts").select("id,name,type").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  async function save() {
    const amountRial = tomanToRial(Number(toEnDigits(amount)) || 0);
    if (amountRial <= 0) { setError("مبلغ پرداخت را وارد کنید."); return; }
    setSaving(true);
    const supabase = createClient();
    try {
      const { error: e } = await supabase.rpc("record_purchase_payment", {
        p_purchase: purchaseId,
        p_amount: amountRial,
        p_account: accountId || null,
        p_method: method,
        p_note: note.trim() || null,
      });
      if (e) throw e;
      onClose();
    } catch (err) {
      setError("خطا: " + (err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="ثبت پرداخت خرید" size="md">
      <div className="space-y-4">
        <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">مانده فعلی: <b>{formatToman(balance)}</b></div>
        <div><label className="label">مبلغ پرداخت (تومان)</label><input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><label className="label">روش پرداخت</label><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">نقد</option><option value="card">کارت</option><option value="transfer">انتقال</option><option value="cheque">چک</option></select></div>
        <div><label className="label">حساب</label><select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">انتخاب...</option>{accounts?.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label className="label">توضیح</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>}
        <div className="flex gap-2"><button onClick={save} disabled={saving} className="btn-primary flex-1">{saving && <Loader2 className="animate-spin" size={18} />} ثبت پرداخت</button><button onClick={onClose} className="btn-secondary">انصراف</button></div>
      </div>
    </Modal>
  );
}
