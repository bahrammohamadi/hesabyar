"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/shared/ui";
import { formatToman, toFaDigits, toJalali } from "@/lib/utils/format";
import { Printer, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
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

  if (isLoading) return <Spinner />;
  if (!data) return <div className="text-center text-slate-400 py-12">فاکتور یافت نشد.</div>;

  const payMethods: string[] = [];
  if (data.paid_cash > 0) payMethods.push("نقدی");
  if (data.paid_card > 0) payMethods.push("کارتی");
  if (data.paid_credit > 0) payMethods.push("نسیه");

  return (
    <div>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link href="/sales" className="flex items-center gap-1 text-slate-500 text-sm">
          <ArrowRight size={18} /> بازگشت
        </Link>
        <button onClick={() => window.print()} className="btn-primary">
          <Printer size={18} /> چاپ / PDF
        </button>
      </div>

      <div className="card p-6 sm:p-8 max-w-2xl mx-auto" id="invoice">
        {/* سربرگ با لوگو */}
        <div className="flex items-center justify-between border-b-2 border-brand-600 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <img src="/mehrjameh-logo.jpg" alt="مهرجامه" className="w-16 h-16 object-contain" />
            <div>
              <h1 className="text-xl font-bold text-brand-700">مهرجامه</h1>
              <p className="text-xs text-slate-500 mt-0.5">پوشاک و مزون</p>
            </div>
          </div>
          <div className="text-left">
            <div className="text-lg font-bold text-slate-800">فاکتور فروش</div>
            <div className="text-sm text-slate-500 mt-1">شماره: {data.invoice_no}</div>
            <div className="text-sm text-slate-500">تاریخ: {toJalali(data.date)}</div>
          </div>
        </div>

        {/* مشتری */}
        <div className="mb-4 text-sm bg-slate-50 rounded-xl p-3 flex flex-wrap gap-x-6 gap-y-1">
          <div>
            <span className="text-slate-500">مشتری: </span>
            <span className="font-medium">{data.customer?.name ?? "مشتری نقدی"}</span>
          </div>
          {data.customer?.code && (
            <div>
              <span className="text-slate-500">کد: </span>
              <span className="font-mono">{data.customer.code}</span>
            </div>
          )}
          {data.customer?.phone && (
            <div dir="ltr">
              <span className="text-slate-500">تلفن: </span>
              {data.customer.phone}
            </div>
          )}
        </div>

        {/* اقلام */}
        <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-brand-50 text-brand-800">
              <th className="px-3 py-2 text-right">#</th>
              <th className="px-3 py-2 text-right">کالا</th>
              <th className="px-3 py-2">کد</th>
              <th className="px-3 py-2">تعداد</th>
              <th className="px-3 py-2">قیمت واحد</th>
              <th className="px-3 py-2">جمع</th>
            </tr>
          </thead>
          <tbody>
            {data.sale_items.map((it: any, idx: number) => (
              <tr key={it.id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-center text-slate-400">{toFaDigits(idx + 1)}</td>
                <td className="px-3 py-2">
                  {it.variant?.product?.name}
                  <span className="text-slate-400 text-xs mr-1">
                    {[it.variant?.color, it.variant?.size].filter(Boolean).join(" / ")}
                  </span>
                </td>
                <td className="px-3 py-2 text-center font-mono text-xs text-slate-500">
                  {it.variant?.sku || it.variant?.product?.code || "-"}
                </td>
                <td className="px-3 py-2 text-center">{toFaDigits(it.qty)}</td>
                <td className="px-3 py-2 text-center">{formatToman(it.unit_price, false)}</td>
                <td className="px-3 py-2 text-center">{formatToman(it.line_total, false)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* جمع‌بندی */}
        <div className="mt-4 flex justify-between items-end gap-4">
          <div className="text-xs text-slate-500">
            <div className="mb-1">روش پرداخت: {payMethods.join("، ") || "—"}</div>
            {data.note && <div>توضیح: {data.note}</div>}
          </div>
          <div className="space-y-1.5 text-sm w-56">
            <Row label="جمع کل" value={formatToman(data.subtotal)} />
            {data.discount > 0 && <Row label="تخفیف" value={formatToman(data.discount)} />}
            <Row label="مبلغ نهایی" value={formatToman(data.total)} bold />
            {data.paid_cash > 0 && <Row label="نقد" value={formatToman(data.paid_cash)} />}
            {data.paid_card > 0 && <Row label="کارت" value={formatToman(data.paid_card)} />}
            {data.paid_credit > 0 && (
              <Row label="باقیمانده (نسیه)" value={formatToman(data.paid_credit)} danger />
            )}
          </div>
        </div>

        <div className="text-center text-xs text-slate-400 mt-8 border-t border-slate-100 pt-4">
          از خرید شما سپاسگزاریم 🌸 — مهرجامه
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }
          body * {
            visibility: hidden;
          }
          #invoice,
          #invoice * {
            visibility: visible;
          }
          #invoice {
            position: absolute;
            top: 0;
            right: 0;
            left: 0;
            margin: 0;
            box-shadow: none;
            border: none;
          }
        }
      `}</style>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  danger,
}: {
  label: string;
  value: string;
  bold?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${
        bold ? "font-bold text-slate-800 text-base border-t border-slate-200 pt-1.5" : danger ? "text-rose-600 font-medium" : "text-slate-500"
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
