"use client";

import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Spinner, EmptyState, Modal } from "@/components/shared/ui";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { PhoneLink } from "@/components/shared/phone-link";
import { formatToman, toFaDigits, toJalali, toEnDigits, tomanToRial } from "@/lib/utils/format";
import { Printer, ArrowRight, Plus, Loader2, CreditCard } from "lucide-react";
import Link from "next/link";

export default function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sale-detail", id],
    queryFn: async () => {
      const supabase = createClient();
      const { data: sale, error } = await supabase
        .from("sales")
        .select(
          `*, customer:contacts(name, phone, address, code),
           sale_items(id, qty, unit_price, discount, line_total,
             variant:product_variants(color, size, sku, product:products(id, name, code)))`
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      const [{ data: summary }, { data: payments }] = await Promise.all([
        supabase.from("sales_payment_summary").select("paid_total, balance, last_payment_at, payment_count").eq("sale_id", id).maybeSingle(),
        supabase.from("transactions").select("id, amount, date, method, note, account:accounts(name)").eq("sale_id", id).order("date", { ascending: false }),
      ]);
      return { ...(sale as any), payment_summary: summary, payments: payments ?? [] };
    },
  });

  if (isLoading) return <Spinner label="در حال بارگذاری..." />;
  if (error) return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <div className="text-rose-500 mb-4">خطا در بارگذاری فاکتور</div>
      <Link href="/sales" className="btn-secondary">بازگشت</Link>
    </div>
  );
  if (!data) return (
    <div className="max-w-2xl mx-auto">
      <EmptyState title="فاکتور یافت نشد" message="این فاکتور وجود ندارد یا حذف شده است." />
    </div>
  );

  const payMethods: string[] = [];
  if (data.paid_cash > 0) payMethods.push("نقدی");
  if (data.paid_card > 0) payMethods.push("کارتی");
  if ((data.payment_summary?.balance ?? data.paid_credit) > 0) payMethods.push("نسیه");
  const paidTotal = data.payment_summary?.paid_total ?? ((data.paid_cash ?? 0) + (data.paid_card ?? 0));
  const balance = data.payment_summary?.balance ?? Math.max(0, (data.total ?? 0) - paidTotal);

  return (
    <>
      {/* CSS for print - using regular style tag */}
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body > * { visibility: hidden !important; }
          #invoice, #invoice * { visibility: visible !important; }
          #invoice { position: absolute; top: 0; left: 0; right: 0; margin: 0; padding: 20px; box-shadow: none !important; border: none !important; background: white !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="max-w-2xl mx-auto">
        {/* Actions - hide on print */}
        <div className="flex items-center justify-between mb-4 no-print">
          <Link href="/sales" className="flex items-center gap-1 text-slate-500 text-sm hover:text-brand-600">
            <ArrowRight size={18} /> بازگشت به لیست
          </Link>
          <div className="flex items-center gap-2">
            {balance > 0 && (
              <button onClick={() => setPaymentOpen(true)} className="btn-secondary flex items-center gap-2">
                <Plus size={16} /> ثبت پرداخت
              </button>
            )}
            <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
              <Printer size={18} /> چاپ / ذخیره PDF
            </button>
          </div>
        </div>

        {/* Invoice */}
        <div id="invoice" className="card p-6 sm:p-8 bg-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-brand-600 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <img 
                src="/mehrjameh-logo.jpg" 
                alt="مهرجامه" 
                className="w-14 h-14 object-contain rounded-xl"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div>
                <h1 className="text-xl font-bold text-brand-700">مهرجامه</h1>
                <p className="text-xs text-slate-500 mt-0.5">پوشاک و مزون</p>
              </div>
            </div>
            <div className="text-left">
              <div className="text-lg font-bold text-slate-800">فاکتور فروش</div>
              <div className="text-sm text-slate-500 mt-1">شماره: {data.invoice_no ?? "—"}</div>
              <div className="text-sm text-slate-500">تاریخ: {toJalali(data.date)}</div>
            </div>
          </div>

          {/* Customer info */}
          <div className="mb-4 p-3 bg-slate-50 rounded-xl text-sm flex flex-wrap gap-4">
            <div>
              <span className="text-slate-500">مشتری: </span>
              {data.customer_id ? (
                <span className="inline-flex items-center gap-2">
                  <EntityLink type="contact" id={data.customer_id}>{data.customer?.name ?? "مشتری"}</EntityLink>
                  <span className="no-print"><EntityActionMenu type="contact" id={data.customer_id} label={data.customer?.name ?? "مشتری"} phone={data.customer?.phone} /></span>
                </span>
              ) : (
                <span className="font-medium">مشتری نقدی</span>
              )}
            </div>
            {data.customer?.code && (
              <div><span className="text-slate-500">کد: </span><span className="font-mono">{data.customer.code}</span></div>
            )}
            {data.customer?.phone && (
              <div><span className="text-slate-500">تلفن: </span><PhoneLink phone={data.customer.phone} /></div>
            )}
          </div>

          {/* Items table */}
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-brand-50 text-brand-800">
                  <th className="px-3 py-2.5 text-right font-medium">#</th>
                  <th className="px-3 py-2.5 text-right font-medium">کالا</th>
                  <th className="px-3 py-2.5 font-medium text-center">کد</th>
                  <th className="px-3 py-2.5 font-medium text-center">تعداد</th>
                  <th className="px-3 py-2.5 font-medium text-center">قیمت</th>
                  <th className="px-3 py-2.5 font-medium text-center">جمع</th>
                </tr>
              </thead>
              <tbody>
                {data.sale_items && data.sale_items.length > 0 ? (
                  data.sale_items.map((it: any, idx: number) => (
                    <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-25">
                      <td className="px-3 py-2.5 text-center text-slate-400">{toFaDigits(idx + 1)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <EntityLink type="product" id={it.variant?.product?.id}>{it.variant?.product?.name ?? "—"}</EntityLink>
                          <span className="no-print"><EntityActionMenu type="product" id={it.variant?.product?.id} label={it.variant?.product?.name} /></span>
                        </div>
                        {(it.variant?.color || it.variant?.size) && (
                          <div className="text-xs text-slate-400">
                            {[it.variant?.color, it.variant?.size].filter(Boolean).join(" / ")}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-xs text-slate-500">
                        {it.variant?.sku || it.variant?.product?.code || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center font-medium">{toFaDigits(it.qty)}</td>
                      <td className="px-3 py-2.5 text-center">{formatToman(it.unit_price, false)}</td>
                      <td className="px-3 py-2.5 text-center font-medium">{formatToman(it.line_total, false)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-400">هیچ آیتمی یافت نشد</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="flex justify-end">
            <div className="w-56 space-y-2">
              <div className="flex justify-between text-slate-500 text-sm">
                <span>جمع کل</span>
                <span>{formatToman(data.subtotal ?? 0, false)}</span>
              </div>
              {data.discount > 0 && (
                <div className="flex justify-between text-rose-500 text-sm">
                  <span>تخفیف</span>
                  <span>-{formatToman(data.discount, false)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-200 pt-2">
                <span>مبلغ نهایی</span>
                <span>{formatToman(data.total ?? 0, false)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 text-sm">
                <span>پرداخت‌شده</span>
                <span>{formatToman(paidTotal, false)}</span>
              </div>
              {balance > 0 && (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>مانده</span>
                  <span>{formatToman(balance, false)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500 mb-2">
              روش پرداخت: {payMethods.join("، ") || "—"}
            </div>
            {data.payments?.length > 0 && (
              <div className="no-print mt-3 rounded-xl bg-slate-50 p-3">
                <div className="mb-2 flex items-center gap-1 text-xs font-medium text-slate-600"><CreditCard size={13} /> پرداخت‌های ثبت‌شده</div>
                <div className="space-y-1">
                  {data.payments.map((p: any) => (
                    <div key={p.id} className="flex justify-between text-xs text-slate-500">
                      <span>{p.note ?? p.method ?? "پرداخت"}</span>
                      <span>{formatToman(p.amount, false)} • {toJalali(p.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.note && <div className="text-xs text-slate-400">توضیح: {data.note}</div>}
          </div>

          <div className="text-center text-xs text-slate-400 mt-6 pt-4 border-t border-slate-100">
            از خرید شما سپاسگزاریم 🌸 — مهرجامه
          </div>
        </div>

        {/* Back button after print */}
        <div className="mt-4 text-center no-print">
          <Link href="/sales" className="btn-secondary">بازگشت</Link>
        </div>
      </div>

      {paymentOpen && (
        <SalePaymentModal
          saleId={id}
          balance={balance}
          onClose={() => {
            setPaymentOpen(false);
            qc.invalidateQueries({ queryKey: ["sale-detail", id] });
            qc.invalidateQueries({ queryKey: ["entity", "contact"] });
          }}
        />
      )}
    </>
  );
}

function SalePaymentModal({ saleId, balance, onClose }: { saleId: string; balance: number; onClose: () => void }) {
  const [amount, setAmount] = useState(String(Math.round(balance / 10)));
  const [method, setMethod] = useState("cash");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: accounts } = useQuery({
    queryKey: ["payment-accounts"],
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
      const { error: e } = await supabase.rpc("record_sale_payment", {
        p_sale: saleId,
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
    <Modal open onClose={onClose} title="ثبت پرداخت فاکتور فروش" size="md">
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
