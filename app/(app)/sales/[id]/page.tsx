"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Spinner, EmptyState } from "@/components/shared/ui";
import { formatToman, toFaDigits, toJalali } from "@/lib/utils/format";
import { Printer, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sale-detail", id],
    queryFn: async () => {
      const supabase = createClient();
      const { data: sale, error } = await supabase
        .from("sales")
        .select(
          `*, customer:contacts(name, phone, address, code),
           sale_items(id, qty, unit_price, discount, line_total,
             variant:product_variants(color, size, sku, product:products(name, code)))`
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return sale as any;
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
  if (data.paid_credit > 0) payMethods.push("نسیه");

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
          <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
            <Printer size={18} /> چاپ / ذخیره PDF
          </button>
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
              <span className="font-medium">{data.customer?.name ?? "مشتری نقدی"}</span>
            </div>
            {data.customer?.code && (
              <div><span className="text-slate-500">کد: </span><span className="font-mono">{data.customer.code}</span></div>
            )}
            {data.customer?.phone && (
              <div dir="ltr"><span className="text-slate-500">تلفن: </span>{data.customer.phone}</div>
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
                        <div className="font-medium">{it.variant?.product?.name ?? "—"}</div>
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
              {data.paid_cash > 0 && (
                <div className="flex justify-between text-slate-500 text-sm">
                  <span>نقدی</span>
                  <span>{formatToman(data.paid_cash, false)}</span>
                </div>
              )}
              {data.paid_card > 0 && (
                <div className="flex justify-between text-slate-500 text-sm">
                  <span>کارتی</span>
                  <span>{formatToman(data.paid_card, false)}</span>
                </div>
              )}
              {data.paid_credit > 0 && (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>نسیه</span>
                  <span>{formatToman(data.paid_credit, false)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500 mb-2">
              روش پرداخت: {payMethods.join("، ") || "—"}
            </div>
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
    </>
  );
}
