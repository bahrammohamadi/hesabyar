"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Calendar, CreditCard, Loader2, Package, Plus, Printer, ShoppingCart, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState, Modal, Spinner } from "@/components/shared/ui";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { EntityLink } from "@/components/shared/entity-link";
import { formatToman, toFaDigits, toJalali, toEnDigits, tomanToRial } from "@/lib/utils/format";

export default function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);

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
          .select("id, type, amount, date, method, note, account:accounts(name)")
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
          {remaining > 0 && <button onClick={() => setPaymentOpen(true)} className="btn-secondary flex items-center gap-2"><Plus size={16} /> ثبت پرداخت</button>}
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
