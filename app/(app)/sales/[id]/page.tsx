"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CreditCard, FileSpreadsheet, Loader2, Plus, Printer, Pencil, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState, Modal, Spinner } from "@/components/shared/ui";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { EntityLink } from "@/components/shared/entity-link";
import { PhoneLink } from "@/components/shared/phone-link";
import { ProductSelector, type SelectableVariant } from "@/components/shared/product-selector";
import { ContactSelector, type SelectableContact } from "@/components/shared/contact-selector";
import { formatToman, rialToToman, toEnDigits, toFaDigits, toJalali, tomanToRial } from "@/lib/utils/format";

type InvoiceItemView = {
  id: string;
  variant_id: string;
  product_id: string | null;
  product_name: string;
  product_code: string | null;
  sku: string | null;
  barcode: string | null;
  color: string | null;
  size: string | null;
  qty: number;
  unit_price: number;
  discount: number;
  line_total: number;
  cost_price: number;
};

type EditInvoiceItem = {
  variant_id: string;
  product_id: string | null;
  product_name: string;
  variant_label: string;
  qty: number;
  unit_price: number;
  discount: number;
  cost_price: number;
  stock_qty: number;
};

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const headers = Object.keys(rows[0] ?? { message: "empty" });
  const csv = "\ufeff" + [headers.map(csvEscape).join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
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

export default function SaleInvoicePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const qc = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sale-invoice-view", id],
    queryFn: async () => {
      const supabase = createClient();

      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .select("*")
        .eq("id", id)
        .single();
      if (saleError) throw saleError;
      if (!sale) throw new Error("فاکتور یافت نشد");

      const [customerResult, itemsResult, paymentSummaryResult, paymentsResult] = await Promise.all([
        sale.customer_id
          ? supabase.from("contacts").select("id,name,phone,address,code").eq("id", sale.customer_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
        supabase.from("sale_items").select("id, variant_id, qty, unit_price, discount, line_total, cost_price").eq("sale_id", id).order("created_at", { ascending: true }),
        supabase.from("sales_payment_summary").select("paid_total,balance,last_payment_at,payment_count").eq("sale_id", id).maybeSingle(),
        supabase.from("transactions").select("id,amount,date,method,note,account:accounts!transactions_account_id_fkey(name)").eq("sale_id", id).order("date", { ascending: false }),
      ]);

      if (customerResult.error) throw customerResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (paymentSummaryResult.error) throw paymentSummaryResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      const rawItems = (itemsResult.data ?? []) as any[];
      const variantIds = rawItems.map((item) => item.variant_id).filter(Boolean);

      let variantsById: Record<string, any> = {};
      let productsById: Record<string, any> = {};

      if (variantIds.length > 0) {
        const { data: variants, error: variantsError } = await supabase
          .from("product_variants")
          .select("id,product_id,color,size,sku,barcode")
          .in("id", variantIds);
        if (variantsError) throw variantsError;
        variantsById = Object.fromEntries((variants ?? []).map((variant: any) => [variant.id, variant]));

        const productIds = Array.from(new Set((variants ?? []).map((variant: any) => variant.product_id).filter(Boolean)));
        if (productIds.length > 0) {
          const { data: products, error: productsError } = await supabase
            .from("products")
            .select("id,name,code")
            .in("id", productIds);
          if (productsError) throw productsError;
          productsById = Object.fromEntries((products ?? []).map((product: any) => [product.id, product]));
        }
      }

      const items: InvoiceItemView[] = rawItems.map((item) => {
        const variant = variantsById[item.variant_id] ?? null;
        const product = variant?.product_id ? productsById[variant.product_id] : null;
        return {
          id: item.id,
          variant_id: item.variant_id,
          product_id: variant?.product_id ?? null,
          product_name: product?.name ?? "کالا",
          product_code: product?.code ?? null,
          sku: variant?.sku ?? null,
          barcode: variant?.barcode ?? null,
          color: variant?.color ?? null,
          size: variant?.size ?? null,
          qty: item.qty ?? 0,
          unit_price: item.unit_price ?? 0,
          discount: item.discount ?? 0,
          line_total: item.line_total ?? 0,
          cost_price: item.cost_price ?? 0,
        };
      });

      const paidTotal = paymentSummaryResult.data?.paid_total ?? ((sale.paid_cash ?? 0) + (sale.paid_card ?? 0));
      const balance = paymentSummaryResult.data?.balance ?? Math.max(0, (sale.total ?? 0) - paidTotal);

      return {
        sale,
        customer: customerResult.data,
        items,
        payments: paymentsResult.data ?? [],
        paymentSummary: paymentSummaryResult.data,
        paidTotal,
        balance,
      };
    },
  });

  if (isLoading) return <Spinner label="در حال بارگذاری فاکتور..." />;

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="card p-6 text-center">
          <h1 className="font-bold text-rose-600 mb-2">خطا در نمایش فاکتور</h1>
          <p className="text-sm text-slate-500 break-words">{(error as Error).message}</p>
          <Link href="/sales" className="btn-secondary mt-5">بازگشت به فروش</Link>
        </div>
      </div>
    );
  }

  if (!data) return <EmptyState title="فاکتور یافت نشد" />;

  const { sale, customer, items, payments, paidTotal, balance } = data;

  function handleExcel() {
    downloadCsv(`invoice-${sale.invoice_no ?? sale.id}.csv`, items.map((item, index) => ({
      row: index + 1,
      invoice_no: sale.invoice_no,
      date: sale.date,
      customer: customer?.name ?? "مشتری نقدی",
      product: item.product_name,
      code: item.product_code ?? "",
      sku: item.sku ?? "",
      barcode: item.barcode ?? "",
      color: item.color ?? "",
      size: item.size ?? "",
      qty: item.qty,
      unit_price: item.unit_price,
      discount: item.discount,
      line_total: item.line_total,
    })));
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body > * { visibility: hidden !important; }
          #invoice-print, #invoice-print * { visibility: visible !important; }
          #invoice-print { position: absolute; inset: 0; margin: 0 auto; width: 100%; max-width: 190mm; box-shadow: none !important; border: none !important; background: #fff !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto">
        <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <Link href="/sales" className="btn-secondary self-start">
            <ArrowRight size={16} /> بازگشت به فروش
          </Link>
          <div className="flex flex-wrap gap-2">
            {sale.status !== "cancelled" && <button onClick={() => setEditOpen(true)} className="btn-secondary"><Pencil size={16} /> ویرایش فاکتور</button>}
            {sale.status !== "cancelled" && <button onClick={() => setCancelOpen(true)} className="btn-secondary text-rose-600"><X size={16} /> ابطال</button>}
            {balance > 0 && sale.status !== "cancelled" && <button onClick={() => setPaymentOpen(true)} className="btn-secondary"><Plus size={16} /> ثبت پرداخت</button>}
            <button onClick={handleExcel} className="btn-secondary"><FileSpreadsheet size={16} /> Excel</button>
            <button onClick={() => window.print()} className="btn-primary"><Printer size={16} /> چاپ / PDF</button>
          </div>
        </div>

        <div id="invoice-print" className="card bg-white p-5 sm:p-8">
          <div className="flex items-start justify-between gap-4 border-b-2 border-brand-600 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="حسابیار" className="w-14 h-14 object-contain rounded-xl" />
              <div>
                <h1 className="text-xl font-bold text-brand-700">مهرجامه</h1>
                <p className="text-xs text-slate-500 mt-1">فاکتور فروش</p>
              </div>
            </div>
            <div className="text-left text-sm text-slate-600">
              <div className="text-lg font-bold text-slate-800">شماره: {sale.invoice_no ?? "—"}</div>
              <div>تاریخ: {toJalali(sale.date)}</div>
              <div>وضعیت: {sale.status === "cancelled" ? "باطل‌شده" : "ثبت‌شده"}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 rounded-2xl bg-slate-50 p-4 text-sm">
            <div>
              <span className="text-slate-500">مشتری: </span>
              {sale.customer_id ? (
                <span className="inline-flex items-center gap-2">
                  <EntityLink type="contact" id={sale.customer_id}>{customer?.name ?? "مشتری"}</EntityLink>
                  <span className="no-print"><EntityActionMenu type="contact" id={sale.customer_id} label={customer?.name ?? "مشتری"} phone={customer?.phone} /></span>
                </span>
              ) : <span className="font-medium">مشتری نقدی</span>}
            </div>
            {customer?.phone && <div><span className="text-slate-500">تلفن: </span><PhoneLink phone={customer.phone} /></div>}
            {customer?.address && <div className="sm:col-span-2"><span className="text-slate-500">آدرس: </span>{customer.address}</div>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-brand-50 text-brand-800">
                  <th className="px-3 py-2 text-right">#</th>
                  <th className="px-3 py-2 text-right">کالا</th>
                  <th className="px-3 py-2 text-center">کد/SKU</th>
                  <th className="px-3 py-2 text-center">تعداد</th>
                  <th className="px-3 py-2 text-center">قیمت</th>
                  <th className="px-3 py-2 text-center">تخفیف</th>
                  <th className="px-3 py-2 text-center">جمع</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">آیتمی در فاکتور ثبت نشده است.</td></tr>
                ) : items.map((item, index) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-400 text-center">{toFaDigits(index + 1)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <EntityLink type="product" id={item.product_id}>{item.product_name}</EntityLink>
                        <span className="no-print"><EntityActionMenu type="product" id={item.product_id} label={item.product_name} /></span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{[item.color, item.size].filter(Boolean).join(" / ") || "ساده"}</div>
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs text-slate-500">{item.sku || item.product_code || item.barcode || "—"}</td>
                    <td className="px-3 py-2 text-center font-medium">{toFaDigits(item.qty)}</td>
                    <td className="px-3 py-2 text-center">{formatToman(item.unit_price, false)}</td>
                    <td className="px-3 py-2 text-center text-rose-500">{item.discount ? formatToman(item.discount, false) : "—"}</td>
                    <td className="px-3 py-2 text-center font-bold">{formatToman(item.line_total, false)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex justify-end">
            <div className="w-full sm:w-72 space-y-2 text-sm">
              <div className="flex justify-between text-slate-500"><span>جمع کل</span><span>{formatToman(sale.subtotal ?? 0, false)}</span></div>
              {sale.discount > 0 && <div className="flex justify-between text-rose-500"><span>تخفیف</span><span>-{formatToman(sale.discount, false)}</span></div>}
              {sale.tax > 0 && <div className="flex justify-between text-slate-500"><span>مالیات</span><span>{formatToman(sale.tax, false)}</span></div>}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-800"><span>مبلغ نهایی</span><span>{formatToman(sale.total ?? 0, false)}</span></div>
              <div className="flex justify-between text-emerald-600"><span>پرداخت‌شده</span><span>{formatToman(paidTotal, false)}</span></div>
              {balance > 0 && <div className="flex justify-between text-rose-600 font-bold"><span>مانده</span><span>{formatToman(balance, false)}</span></div>}
            </div>
          </div>

          {payments.length > 0 && (
            <div className="no-print mt-5 rounded-2xl bg-slate-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><CreditCard size={15} /> پرداخت‌ها</div>
              <div className="space-y-1">
                {payments.map((payment: any) => (
                  <div key={payment.id} className="flex justify-between text-xs text-slate-500">
                    <span>{payment.note ?? payment.method ?? "پرداخت"}</span>
                    <span>{formatToman(payment.amount, false)} • {toJalali(payment.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sale.note && <div className="mt-5 text-xs text-slate-500">توضیح: {sale.note}</div>}
          <div className="mt-8 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">از خرید شما سپاسگزاریم 🌸</div>
        </div>
      </div>

      {editOpen && (
        <EditInvoiceModal
          sale={sale}
          customer={customer}
          items={items}
          onClose={() => {
            setEditOpen(false);
            qc.invalidateQueries({ queryKey: ["sale-invoice-view", id] });
          }}
        />
      )}

      {cancelOpen && (
        <CancelSaleModal
          saleId={id}
          invoiceNo={sale.invoice_no}
          onClose={() => {
            setCancelOpen(false);
            qc.invalidateQueries({ queryKey: ["sale-invoice-view", id] });
          }}
        />
      )}

      {paymentOpen && (
        <SalePaymentModal
          saleId={id}
          balance={balance}
          onClose={() => {
            setPaymentOpen(false);
            qc.invalidateQueries({ queryKey: ["sale-invoice-view", id] });
            qc.invalidateQueries({ queryKey: ["entity", "contact"] });
          }}
        />
      )}
    </>
  );
}


function EditInvoiceModal({
  sale,
  customer,
  items,
  onClose,
}: {
  sale: any;
  customer: any | null;
  items: InvoiceItemView[];
  onClose: () => void;
}) {
  const [date, setDate] = useState(String(sale.date ?? "").slice(0, 10));
  const [selectedCustomer, setSelectedCustomer] = useState<SelectableContact | null>(customer ? { id: customer.id, name: customer.name, phone: customer.phone ?? null, type: "customer" as any } : null);
  const [cart, setCart] = useState<EditInvoiceItem[]>(items.map((item) => ({
    variant_id: item.variant_id,
    product_id: item.product_id,
    product_name: item.product_name,
    variant_label: [item.color, item.size].filter(Boolean).join(" / "),
    qty: item.qty,
    unit_price: item.unit_price,
    discount: item.discount,
    cost_price: item.cost_price,
    stock_qty: 0,
  })));
  const [discountType, setDiscountType] = useState<"fixed" | "percent">((sale.discount_type === "percent" ? "percent" : "fixed") as any);
  const [discountValue, setDiscountValue] = useState(String(sale.discount_type === "percent" ? (sale.discount_value ?? 0) : rialToToman(sale.discount ?? 0)));
  const [tax, setTax] = useState(String(rialToToman(sale.tax ?? 0)));
  const [note, setNote] = useState(sale.note ?? "");
  const [productOpen, setProductOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.qty - item.discount, 0);
  const discountInput = Number(toEnDigits(discountValue)) || 0;
  const discountRial = discountType === "percent" ? Math.round((subtotal * discountInput) / 100) : tomanToRial(discountInput);
  const taxRial = tomanToRial(Number(toEnDigits(tax)) || 0);
  const total = Math.max(0, subtotal - discountRial + taxRial);

  function addProduct(v: SelectableVariant) {
    setCart((prev) => {
      const existing = prev.find((item) => item.variant_id === v.variant_id);
      if (existing) return prev.map((item) => item.variant_id === v.variant_id ? { ...item, qty: item.qty + 1 } : item);
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

  async function save() {
    setError(null);
    if (cart.length === 0) { setError("فاکتور باید حداقل یک کالا داشته باشد."); return; }
    setSaving(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("update_sale_invoice", {
        p_sale: sale.id,
        p_customer: selectedCustomer?.id ?? null,
        p_date: date ? new Date(`${date}T12:00:00`).toISOString() : sale.date,
        p_items: cart.map((item) => ({
          variant_id: item.variant_id,
          qty: item.qty,
          unit_price: item.unit_price,
          discount: item.discount,
          cost_price: item.cost_price,
        })),
        p_discount_type: discountType,
        p_discount_value: discountType === "percent" ? discountInput : discountRial,
        p_discount: discountRial,
        p_tax: taxRial,
        p_note: note.trim() || null,
      });
      if (error) throw error;
      onClose();
    } catch (e) {
      setError("خطا در ویرایش فاکتور: " + (e as Error).message);
      setSaving(false);
    }
  }

  return (
    <>
      <Modal open onClose={onClose} title="ویرایش فاکتور فروش" size="lg" mobileFullscreen>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">تاریخ فاکتور</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label className="label">مشتری</label>{selectedCustomer ? <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5"><span>{selectedCustomer.name}</span><button onClick={() => setSelectedCustomer(null)} className="text-rose-500"><X size={16}/></button></div> : <button onClick={() => setCustomerOpen(true)} className="btn-secondary w-full">انتخاب مشتری</button>}</div>
          </div>

          <button onClick={() => setProductOpen(true)} className="w-full rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-4 py-3 text-sm font-medium text-brand-700">+ افزودن کالا</button>

          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {cart.map((item) => (
              <div key={item.variant_id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div><div className="font-medium text-sm">{item.product_name}</div><div className="text-xs text-slate-400">{item.variant_label || "ساده"}</div></div>
                  <button onClick={() => setCart((prev) => prev.filter((x) => x.variant_id !== item.variant_id))} className="text-rose-500"><Trash2 size={16}/></button>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div><label className="text-xs text-slate-400">تعداد</label><input className="input" inputMode="numeric" value={String(item.qty)} onChange={(e) => setCart((prev) => prev.map((x) => x.variant_id === item.variant_id ? { ...x, qty: Number(toEnDigits(e.target.value)) || 1 } : x))} /></div>
                  <div><label className="text-xs text-slate-400">قیمت فروش</label><input className="input" inputMode="numeric" value={String(rialToToman(item.unit_price))} onChange={(e) => setCart((prev) => prev.map((x) => x.variant_id === item.variant_id ? { ...x, unit_price: tomanToRial(Number(toEnDigits(e.target.value)) || 0) } : x))} /></div>
                  <div><label className="text-xs text-slate-400">تخفیف ردیف</label><input className="input" inputMode="numeric" value={String(rialToToman(item.discount))} onChange={(e) => setCart((prev) => prev.map((x) => x.variant_id === item.variant_id ? { ...x, discount: tomanToRial(Number(toEnDigits(e.target.value)) || 0) } : x))} /></div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-100 pt-4">
            <div><label className="label">تخفیف فاکتور</label><div className="flex gap-2"><input className="input" inputMode="numeric" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} /><select className="input w-28" value={discountType} onChange={(e) => setDiscountType(e.target.value as any)}><option value="fixed">تومان</option><option value="percent">٪</option></select></div></div>
            <div><label className="label">مالیات (تومان)</label><input className="input" inputMode="numeric" value={tax} onChange={(e) => setTax(e.target.value)} /></div>
            <div><label className="label">جمع نهایی</label><div className="rounded-xl bg-slate-50 px-3.5 py-2.5 font-bold text-slate-800">{formatToman(total)}</div></div>
          </div>
          <div><label className="label">توضیح</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm p-3">{error}</div>}
          <div className="flex gap-2"><button onClick={save} disabled={saving} className="btn-primary flex-1">{saving && <Loader2 className="animate-spin" size={16}/>} ذخیره تغییرات</button><button onClick={onClose} className="btn-secondary">انصراف</button></div>
        </div>
      </Modal>
      <ProductSelector open={productOpen} onClose={() => setProductOpen(false)} onSelect={(v) => { addProduct(v); setProductOpen(false); }} />
      <ContactSelector open={customerOpen} onClose={() => setCustomerOpen(false)} onSelect={(c) => { setSelectedCustomer(c); setCustomerOpen(false); }} filterType="customer" title="انتخاب مشتری" />
    </>
  );
}

function CancelSaleModal({ saleId, invoiceNo, onClose }: { saleId: string; invoiceNo?: string | null; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setSaving(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("cancel_sale", { p_sale: saleId, p_reason: reason.trim() || "ابطال از صفحه فاکتور" });
      if (error) throw error;
      onClose();
    } catch (e) { setError("خطا در ابطال: " + (e as Error).message); setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="ابطال فاکتور فروش" size="md">
      <div className="space-y-4">
        <div className="rounded-xl bg-rose-50 text-rose-700 p-3 text-sm">فاکتور {invoiceNo ?? ""} باطل می‌شود؛ موجودی اقلام برمی‌گردد و پرداخت‌ها خنثی می‌شوند.</div>
        <div><label className="label">دلیل ابطال</label><textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm p-3">{error}</div>}
        <div className="flex gap-2"><button onClick={cancel} disabled={saving} className="btn-danger flex-1">{saving && <Loader2 className="animate-spin" size={16}/>} ابطال فاکتور</button><button onClick={onClose} className="btn-secondary">انصراف</button></div>
      </div>
    </Modal>
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
    queryKey: ["invoice-payment-accounts"],
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
      const { error } = await supabase.rpc("record_sale_payment", {
        p_sale: saleId,
        p_amount: amountRial,
        p_account: accountId || null,
        p_method: method,
        p_note: note.trim() || null,
      });
      if (error) throw error;
      onClose();
    } catch (e) {
      setError("خطا: " + (e as Error).message);
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
