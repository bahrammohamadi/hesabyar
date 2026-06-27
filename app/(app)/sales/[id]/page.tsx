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
          `*, customer:contacts(name, phone, address),
           sale_items(id, qty, unit_price, discount, line_total,
             variant:product_variants(color, size, sku, product:products(name)))`
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return sale as any;
    },
  });

  if (isLoading) return <Spinner />;
  if (!data) return <div className="text-center text-slate-400 py-12">فاکتور یافت نشد.</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link href="/sales" className="flex items-center gap-1 text-slate-500 text-sm">
          <ArrowRight size={18} /> بازگشت
        </Link>
        <button onClick={() => window.print()} className="btn-primary">
          <Printer size={18} /> چاپ فاکتور
        </button>
      </div>

      <div className="card p-6 sm:p-8 max-w-2xl mx-auto" id="invoice">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">فاکتور فروش</h1>
            <p className="text-sm text-slate-500 mt-1">شماره: {data.invoice_no}</p>
          </div>
          <div className="text-left text-sm text-slate-500">
            <div>تاریخ: {toJalali(data.date)}</div>
          </div>
        </div>

        <div className="mb-4 text-sm">
          <span className="text-slate-500">مشتری: </span>
          <span className="font-medium">{data.customer?.name ?? "مشتری نقدی"}</span>
          {data.customer?.phone && (
            <span className="text-slate-400 mr-2" dir="ltr">
              {data.customer.phone}
            </span>
          )}
        </div>

        <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              <th className="px-3 py-2 text-right">کالا</th>
              <th className="px-3 py-2">تعداد</th>
              <th className="px-3 py-2">قیمت واحد</th>
              <th className="px-3 py-2">جمع</th>
            </tr>
          </thead>
          <tbody>
            {data.sale_items.map((it: any) => (
              <tr key={it.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  {it.variant?.product?.name}
                  <span className="text-slate-400 text-xs mr-1">
                    {[it.variant?.color, it.variant?.size].filter(Boolean).join(" / ")}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">{toFaDigits(it.qty)}</td>
                <td className="px-3 py-2 text-center">{formatToman(it.unit_price, false)}</td>
                <td className="px-3 py-2 text-center">{formatToman(it.line_total, false)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 space-y-1.5 text-sm max-w-xs mr-auto">
          <Row label="جمع کل" value={formatToman(data.subtotal)} />
          <Row label="تخفیف" value={formatToman(data.discount)} />
          <Row label="مبلغ نهایی" value={formatToman(data.total)} bold />
          <Row label="نقد" value={formatToman(data.paid_cash)} />
          <Row label="کارت" value={formatToman(data.paid_card)} />
          {data.paid_credit > 0 && (
            <Row label="نسیه (باقیمانده)" value={formatToman(data.paid_credit)} />
          )}
        </div>

        <div className="text-center text-xs text-slate-400 mt-8 border-t border-slate-100 pt-4">
          با تشکر از خرید شما 🌸
        </div>
      </div>

      <style jsx global>{`
        @media print {
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

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-slate-800 text-base" : "text-slate-500"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
