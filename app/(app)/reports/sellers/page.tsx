"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, UserCheck } from "lucide-react";
import { EmptyState, PageHeader, Spinner } from "@/components/shared/ui";
import { formatToman, toFaDigits, toJalali } from "@/lib/utils/format";

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return alert("داده‌ای برای خروجی وجود ندارد.");
  const headers = Object.keys(rows[0]);
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

export default function SellerReportPage() {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading, error } = useQuery({
    queryKey: ["seller-performance", from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/reports/sellers?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطا در دریافت گزارش فروشنده");
      return json as { sellers: any[]; sales: any[] };
    },
  });

  const totals = useMemo(() => {
    const sellers = data?.sellers ?? [];
    return {
      sales_total: sellers.reduce((sum, seller) => sum + (seller.sales_total ?? 0), 0),
      invoice_count: sellers.reduce((sum, seller) => sum + (seller.invoice_count ?? 0), 0),
      activity_count: sellers.reduce((sum, seller) => sum + (seller.activity_count ?? 0), 0),
    };
  }, [data]);

  function exportExcel() {
    downloadCsv(`seller-performance-${from}-${to}.csv`, (data?.sellers ?? []).map((seller) => ({
      name: seller.user?.name ?? "نامشخص",
      email: seller.user?.email ?? "",
      invoice_count: seller.invoice_count,
      sales_total: seller.sales_total,
      credit_total: seller.credit_total,
      average_invoice: seller.average_invoice,
      activity_count: seller.activity_count,
      last_sale_at: seller.last_sale_at,
    })));
  }

  return (
    <div>
      <PageHeader
        title="گزارش عملکرد فروشنده"
        subtitle="مقایسه تعداد فاکتور، مبلغ فروش و فعالیت کاربران در بازه انتخاب‌شده"
        action={
          <div className="flex gap-2">
            <button onClick={exportExcel} className="btn-secondary"><Download size={16} /> Excel</button>
            <button onClick={() => window.print()} className="btn-secondary"><Printer size={16} /> PDF</button>
          </div>
        }
      />

      <div className="card p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div><label className="label">از تاریخ</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label">تا تاریخ</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">مجموع فروش</div><div className="font-bold text-emerald-600 mt-1">{formatToman(totals.sales_total)}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">تعداد فاکتور</div><div className="font-bold text-slate-800 mt-1">{toFaDigits(totals.invoice_count)}</div></div>
      </div>

      {isLoading ? <Spinner /> : error ? <div className="rounded-xl bg-rose-50 text-rose-700 text-sm p-4">{(error as Error).message}</div> : !data?.sellers?.length ? <EmptyState icon={UserCheck} title="داده‌ای برای این بازه وجود ندارد" /> : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>فروشنده</th><th>فاکتور</th><th>مبلغ فروش</th><th>نسیه</th><th>میانگین فاکتور</th><th>فعالیت‌ها</th><th>آخرین فروش</th></tr></thead>
            <tbody>
              {data.sellers.map((seller) => (
                <tr key={seller.user_id ?? "unknown"} className="hover:bg-slate-50">
                  <td><div className="font-medium text-slate-800">{seller.user?.name ?? "نامشخص"}</div><div className="text-xs text-slate-400" dir="ltr">{seller.user?.email ?? ""}</div></td>
                  <td>{toFaDigits(seller.invoice_count)}</td>
                  <td className="font-bold text-emerald-600">{formatToman(seller.sales_total, false)}</td>
                  <td className="text-rose-600">{formatToman(seller.credit_total, false)}</td>
                  <td>{formatToman(seller.average_invoice, false)}</td>
                  <td>{toFaDigits(seller.activity_count)}</td>
                  <td>{seller.last_sale_at ? toJalali(seller.last_sale_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
