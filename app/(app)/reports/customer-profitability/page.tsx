"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState, PageHeader, Spinner } from "@/components/shared/ui";
import { DatePicker } from "@/components/shared/date-picker";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { EntityLink } from "@/components/shared/entity-link";
import { formatToman, toFaDigits, toJalali } from "@/lib/utils/format";
import { downloadCsv } from "@/lib/export/download";



export default function CustomerProfitabilityReportPage() {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [onlyWithCustomer, setOnlyWithCustomer] = useState(true);

  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-profitability", from, to, onlyWithCustomer],
    queryFn: async () => {
      const supabase = createClient();
      let salesQuery = supabase
        .from("sales")
        .select("id,invoice_no,date,total,discount,tax,status,customer_id,customer:contacts(id,name,phone)")
        .eq("status", "confirmed")
        .order("date", { ascending: false })
        .limit(2000);
      if (from) salesQuery = salesQuery.gte("date", new Date(`${from}T00:00:00`).toISOString());
      if (to) salesQuery = salesQuery.lte("date", new Date(`${to}T23:59:59`).toISOString());
      if (onlyWithCustomer) salesQuery = salesQuery.not("customer_id", "is", null);

      const { data: sales, error: salesError } = await salesQuery;
      if (salesError) throw salesError;
      const saleIds = (sales ?? []).map((sale: any) => sale.id);
      if (!saleIds.length) return { sales: [], items: [] };

      const { data: items, error: itemsError } = await supabase
        .from("sale_items")
        .select("id,sale_id,qty,line_total,cost_price")
        .in("sale_id", saleIds)
        .limit(20000);
      if (itemsError) throw itemsError;
      return { sales: sales ?? [], items: items ?? [] };
    },
  });

  const rows = useMemo(() => {
    const saleStats = new Map<string, { revenue: number; cost: number; qty: number }>();
    (data?.items ?? []).forEach((item: any) => {
      const current = saleStats.get(item.sale_id) ?? { revenue: 0, cost: 0, qty: 0 };
      current.revenue += item.line_total ?? 0;
      current.cost += (item.cost_price ?? 0) * (item.qty ?? 0);
      current.qty += item.qty ?? 0;
      saleStats.set(item.sale_id, current);
    });

    const customerStats = new Map<string, any>();
    (data?.sales ?? []).forEach((sale: any) => {
      const key = sale.customer_id ?? "walk-in";
      const current = customerStats.get(key) ?? {
        customer_id: sale.customer_id,
        customer_name: sale.customer?.name ?? "مشتری نقدی",
        phone: sale.customer?.phone ?? "",
        invoice_count: 0,
        qty: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        last_sale_at: null,
      };
      const stat = saleStats.get(sale.id) ?? { revenue: 0, cost: 0, qty: 0 };
      current.invoice_count += 1;
      current.qty += stat.qty;
      current.revenue += stat.revenue;
      current.cost += stat.cost;
      current.profit = current.revenue - current.cost;
      if (!current.last_sale_at || new Date(sale.date) > new Date(current.last_sale_at)) current.last_sale_at = sale.date;
      customerStats.set(key, current);
    });

    return Array.from(customerStats.values()).map((row) => ({
      ...row,
      average_invoice: row.invoice_count ? Math.round(row.revenue / row.invoice_count) : 0,
      margin: row.revenue > 0 ? Math.round((row.profit / row.revenue) * 1000) / 10 : 0,
    })).sort((a, b) => b.profit - a.profit);
  }, [data]);

  const totals = useMemo(() => ({
    revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    cost: rows.reduce((sum, row) => sum + row.cost, 0),
    profit: rows.reduce((sum, row) => sum + row.profit, 0),
    invoices: rows.reduce((sum, row) => sum + row.invoice_count, 0),
  }), [rows]);

  function exportExcel() {
    downloadCsv(`customer-profitability-${from}-${to}.csv`, rows.map((row) => ({
      customer: row.customer_name,
      phone: row.phone,
      invoice_count: row.invoice_count,
      qty: row.qty,
      revenue: row.revenue,
      cost: row.cost,
      profit: row.profit,
      margin_percent: row.margin,
      average_invoice: row.average_invoice,
      last_sale_at: row.last_sale_at,
    })));
  }

  return (
    <div>
      <PageHeader
        title="گزارش مشتریان سودآور"
        subtitle="تحلیل سود ناخالص هر مشتری بر اساس فروش و بهای تمام‌شده اقلام فاکتور"
        action={
          <div className="flex gap-2">
            <button onClick={exportExcel} className="btn-secondary"><Download size={16} /> Excel</button>
            <button onClick={() => window.print()} className="btn-secondary"><Printer size={16} /> PDF</button>
          </div>
        }
      />

      <div className="card p-4 mb-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div><label className="label">از تاریخ</label><DatePicker value={from} onChange={setFrom} /></div>
        <div><label className="label">تا تاریخ</label><DatePicker value={to} onChange={setTo} /></div>
        <label className="flex items-end gap-2 text-sm text-muted-foreground pb-3"><input type="checkbox" checked={onlyWithCustomer} onChange={(e) => setOnlyWithCustomer(e.target.checked)} /> فقط مشتریان ثبت‌شده</label>
        <div className="rounded-xl bg-muted p-3"><div className="text-xs text-muted-foreground">تعداد فاکتور</div><div className="font-bold text-foreground mt-1">{toFaDigits(totals.invoices)}</div></div>
        <div className="rounded-xl bg-muted p-3"><div className="text-xs text-muted-foreground">سود کل</div><div className={totals.profit >= 0 ? "font-bold text-success-onSoft mt-1" : "font-bold text-destructive mt-1"}>{formatToman(totals.profit)}</div></div>
      </div>

      {isLoading ? <Spinner /> : error ? <div className="rounded-xl bg-destructive/10 text-destructive-text text-sm p-4">{(error as Error).message}</div> : !rows.length ? <EmptyState icon={Users} title="داده‌ای برای این بازه وجود ندارد" /> : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>مشتری</th><th>فاکتور</th><th>تعداد کالا</th><th>فروش</th><th>بها</th><th>سود</th><th>حاشیه</th><th>میانگین فاکتور</th><th>آخرین خرید</th><th>عملیات</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.customer_id ?? "walk-in"} className="hover:bg-muted">
                  <td>{row.customer_id ? <EntityLink type="contact" id={row.customer_id}>{row.customer_name}</EntityLink> : <span className="text-muted-foreground">مشتری نقدی</span>}<div className="text-xs text-muted-foreground" dir="ltr">{row.phone}</div></td>
                  <td>{toFaDigits(row.invoice_count)}</td>
                  <td>{toFaDigits(row.qty)}</td>
                  <td>{formatToman(row.revenue, false)}</td>
                  <td>{formatToman(row.cost, false)}</td>
                  <td className={row.profit >= 0 ? "text-success-onSoft font-bold" : "text-destructive font-bold"}>{formatToman(row.profit, false)}</td>
                  <td>{toFaDigits(row.margin)}٪</td>
                  <td>{formatToman(row.average_invoice, false)}</td>
                  <td>{row.last_sale_at ? toJalali(row.last_sale_at) : "—"}</td>
                  <td>{row.customer_id && <EntityActionMenu type="contact" id={row.customer_id} label={row.customer_name} phone={row.phone} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
