"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState, PageHeader, Spinner } from "@/components/shared/ui";
import { DatePicker } from "@/components/shared/date-picker";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { EntityLink } from "@/components/shared/entity-link";
import { formatToman, toFaDigits, toJalali } from "@/lib/utils/format";
import { downloadCsv } from "@/lib/export/download";

type Tab = "products" | "invoices";



export default function ProfitabilityReportPage() {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState<Tab>("products");

  const { data, isLoading, error } = useQuery({
    queryKey: ["profitability-report", from, to],
    queryFn: async () => {
      const supabase = createClient();
      let salesQuery = supabase
        .from("sales")
        .select("id,invoice_no,date,total,discount,tax,status,customer:contacts(name)")
        .eq("status", "confirmed")
        .order("date", { ascending: false })
        .limit(1000);
      if (from) salesQuery = salesQuery.gte("date", new Date(`${from}T00:00:00`).toISOString());
      if (to) salesQuery = salesQuery.lte("date", new Date(`${to}T23:59:59`).toISOString());

      const { data: sales, error: salesError } = await salesQuery;
      if (salesError) throw salesError;
      const saleIds = (sales ?? []).map((sale: any) => sale.id);
      if (!saleIds.length) return { sales: [], items: [] };

      const { data: items, error: itemsError } = await supabase
        .from("sale_items")
        .select("id,sale_id,variant_id,qty,unit_price,line_total,cost_price,variant:product_variants(id,product:products(id,name,code))")
        .in("sale_id", saleIds)
        .limit(10000);
      if (itemsError) throw itemsError;

      return { sales: sales ?? [], items: items ?? [] };
    },
  });

  const invoiceRows = useMemo(() => {
    const sales = data?.sales ?? [];
    const items = data?.items ?? [];
    const bySale = new Map<string, { revenue: number; cost: number; qty: number }>();
    items.forEach((item: any) => {
      const current = bySale.get(item.sale_id) ?? { revenue: 0, cost: 0, qty: 0 };
      current.revenue += item.line_total ?? 0;
      current.cost += (item.cost_price ?? 0) * (item.qty ?? 0);
      current.qty += item.qty ?? 0;
      bySale.set(item.sale_id, current);
    });

    return sales.map((sale: any) => {
      const stat = bySale.get(sale.id) ?? { revenue: 0, cost: 0, qty: 0 };
      const profit = stat.revenue - stat.cost;
      const margin = stat.revenue > 0 ? Math.round((profit / stat.revenue) * 1000) / 10 : 0;
      return { sale, ...stat, profit, margin };
    }).sort((a: any, b: any) => b.profit - a.profit);
  }, [data]);

  const productRows = useMemo(() => {
    const items = data?.items ?? [];
    const map = new Map<string, any>();
    items.forEach((item: any) => {
      const product = item.variant?.product;
      const key = product?.id ?? item.variant_id;
      const current = map.get(key) ?? {
        product_id: product?.id ?? null,
        product_name: product?.name ?? "کالا",
        product_code: product?.code ?? "",
        qty: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        invoice_count: new Set<string>(),
      };
      current.qty += item.qty ?? 0;
      current.revenue += item.line_total ?? 0;
      current.cost += (item.cost_price ?? 0) * (item.qty ?? 0);
      current.invoice_count.add(item.sale_id);
      current.profit = current.revenue - current.cost;
      map.set(key, current);
    });

    return Array.from(map.values()).map((row) => ({
      ...row,
      invoice_count: row.invoice_count.size,
      margin: row.revenue > 0 ? Math.round((row.profit / row.revenue) * 1000) / 10 : 0,
    })).sort((a, b) => b.profit - a.profit);
  }, [data]);

  const totals = useMemo(() => {
    const source = tab === "products" ? productRows : invoiceRows;
    return {
      revenue: source.reduce((sum: number, row: any) => sum + row.revenue, 0),
      cost: source.reduce((sum: number, row: any) => sum + row.cost, 0),
      profit: source.reduce((sum: number, row: any) => sum + row.profit, 0),
    };
  }, [productRows, invoiceRows, tab]);

  function exportExcel() {
    if (tab === "products") {
      downloadCsv(`product-profit-${from}-${to}.csv`, productRows.map((row: any) => ({
        product: row.product_name,
        code: row.product_code,
        qty: row.qty,
        invoice_count: row.invoice_count,
        revenue: row.revenue,
        cost: row.cost,
        profit: row.profit,
        margin_percent: row.margin,
      })));
    } else {
      downloadCsv(`invoice-profit-${from}-${to}.csv`, invoiceRows.map((row: any) => ({
        invoice_no: row.sale.invoice_no,
        date: row.sale.date,
        customer: row.sale.customer?.name ?? "مشتری نقدی",
        qty: row.qty,
        revenue: row.revenue,
        cost: row.cost,
        profit: row.profit,
        margin_percent: row.margin,
      })));
    }
  }

  return (
    <div>
      <PageHeader
        title="گزارش سود کالا و فاکتور"
        subtitle="تحلیل سود ناخالص بر اساس قیمت فروش ثبت‌شده و بهای تمام‌شده snapshot در فاکتور"
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
        <div className="rounded-xl bg-muted p-3"><div className="text-xs text-muted-foreground">فروش</div><div className="font-bold text-foreground mt-1">{formatToman(totals.revenue)}</div></div>
        <div className="rounded-xl bg-muted p-3"><div className="text-xs text-muted-foreground">بهای تمام‌شده</div><div className="font-bold text-warning-onSoft mt-1">{formatToman(totals.cost)}</div></div>
        <div className="rounded-xl bg-muted p-3"><div className="text-xs text-muted-foreground">سود ناخالص</div><div className={totals.profit >= 0 ? "font-bold text-success-onSoft mt-1" : "font-bold text-destructive mt-1"}>{formatToman(totals.profit)}</div></div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("products")} className={tab === "products" ? "btn-primary" : "btn-secondary"}>سود کالا</button>
        <button onClick={() => setTab("invoices")} className={tab === "invoices" ? "btn-primary" : "btn-secondary"}>سود فاکتور</button>
      </div>

      {isLoading ? <Spinner /> : error ? <div className="rounded-xl bg-destructive/10 text-destructive-text text-sm p-4">{(error as Error).message}</div> : tab === "products" ? (
        !productRows.length ? <EmptyState icon={TrendingUp} title="داده‌ای برای این بازه نیست" /> : (
          <div className="card overflow-x-auto">
            <table className="table-base"><thead><tr><th>کالا</th><th>تعداد</th><th>فاکتور</th><th>فروش</th><th>بها</th><th>سود</th><th>حاشیه</th><th>عملیات</th></tr></thead><tbody>
              {productRows.map((row: any) => <tr key={row.product_id ?? row.product_name} className="hover:bg-muted"><td><EntityLink type="product" id={row.product_id}>{row.product_name}</EntityLink><div className="text-xs text-muted-foreground">{row.product_code}</div></td><td>{toFaDigits(row.qty)}</td><td>{toFaDigits(row.invoice_count)}</td><td>{formatToman(row.revenue, false)}</td><td>{formatToman(row.cost, false)}</td><td className={row.profit >= 0 ? "text-success-onSoft font-bold" : "text-destructive font-bold"}>{formatToman(row.profit, false)}</td><td>{toFaDigits(row.margin)}٪</td><td><EntityActionMenu type="product" id={row.product_id} label={row.product_name} /></td></tr>)}
            </tbody></table>
          </div>
        )
      ) : (
        !invoiceRows.length ? <EmptyState icon={TrendingUp} title="فاکتوری برای این بازه نیست" /> : (
          <div className="card overflow-x-auto">
            <table className="table-base"><thead><tr><th>فاکتور</th><th>تاریخ</th><th>مشتری</th><th>تعداد</th><th>فروش</th><th>بها</th><th>سود</th><th>حاشیه</th></tr></thead><tbody>
              {invoiceRows.map((row: any) => <tr key={row.sale.id} className="hover:bg-muted"><td><EntityLink type="sale" id={row.sale.id}>{row.sale.invoice_no}</EntityLink></td><td>{toJalali(row.sale.date)}</td><td>{row.sale.customer?.name ?? "مشتری نقدی"}</td><td>{toFaDigits(row.qty)}</td><td>{formatToman(row.revenue, false)}</td><td>{formatToman(row.cost, false)}</td><td className={row.profit >= 0 ? "text-success-onSoft font-bold" : "text-destructive font-bold"}>{formatToman(row.profit, false)}</td><td>{toFaDigits(row.margin)}٪</td></tr>)}
            </tbody></table>
          </div>
        )
      )}
    </div>
  );
}
