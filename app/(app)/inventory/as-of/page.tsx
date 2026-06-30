"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Download, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { EmptyState, PageHeader, Spinner } from "@/components/shared/ui";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { EntityLink } from "@/components/shared/entity-link";
import { formatToman, toFaDigits } from "@/lib/utils/format";

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

export default function InventoryAsOfPage() {
  const { orgId } = useOrg();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [onlyPositive, setOnlyPositive] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["inventory-as-of", orgId, date],
    enabled: !!orgId && !!date,
    queryFn: async () => {
      const supabase = createClient();
      const toIso = new Date(`${date}T23:59:59`).toISOString();
      const [{ data: variants, error: variantsError }, { data: movements, error: movementsError }] = await Promise.all([
        supabase
          .from("product_variants")
          .select("id,color,size,sku,barcode,purchase_price,sale_price,product:products!inner(id,name,code,low_stock_threshold)")
          .eq("is_active", true)
          .limit(10000),
        supabase
          .from("stock_movements")
          .select("variant_id,qty,created_at")
          .lte("created_at", toIso)
          .limit(50000),
      ]);
      if (variantsError) throw variantsError;
      if (movementsError) throw movementsError;
      const stockMap = new Map<string, number>();
      (movements ?? []).forEach((m: any) => stockMap.set(m.variant_id, (stockMap.get(m.variant_id) ?? 0) + (m.qty ?? 0)));
      return (variants ?? []).map((v: any) => ({
        variant_id: v.id,
        product_id: v.product?.id,
        product_name: v.product?.name ?? "کالا",
        product_code: v.product?.code ?? "",
        color: v.color ?? "",
        size: v.size ?? "",
        sku: v.sku ?? "",
        barcode: v.barcode ?? "",
        purchase_price: v.purchase_price ?? 0,
        sale_price: v.sale_price ?? 0,
        low_stock_threshold: v.product?.low_stock_threshold ?? 0,
        stock_qty: stockMap.get(v.id) ?? 0,
      }));
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? [])
      .filter((row: any) => !onlyPositive || row.stock_qty > 0)
      .filter((row: any) => {
        if (!term) return true;
        return `${row.product_name} ${row.product_code} ${row.sku} ${row.barcode} ${row.color} ${row.size}`.toLowerCase().includes(term);
      })
      .sort((a: any, b: any) => b.stock_qty - a.stock_qty);
  }, [data, search, onlyPositive]);

  const totalQty = rows.reduce((sum: number, row: any) => sum + row.stock_qty, 0);
  const totalValue = rows.reduce((sum: number, row: any) => sum + row.stock_qty * (row.purchase_price ?? 0), 0);
  const lowCount = rows.filter((row: any) => row.stock_qty <= row.low_stock_threshold).length;

  function exportExcel() {
    downloadCsv(`inventory-as-of-${date}.csv`, rows.map((row: any) => ({
      date,
      product: row.product_name,
      code: row.product_code,
      sku: row.sku,
      barcode: row.barcode,
      color: row.color,
      size: row.size,
      stock_qty: row.stock_qty,
      purchase_price: row.purchase_price,
      sale_price: row.sale_price,
      inventory_value: row.stock_qty * row.purchase_price,
    })));
  }

  return (
    <div>
      <PageHeader
        title="موجودی به تاریخ"
        subtitle="محاسبه موجودی کالاها بر اساس گردش انبار تا پایان تاریخ انتخاب‌شده"
        action={<button onClick={exportExcel} className="btn-secondary"><Download size={16} /> Excel</button>}
      />

      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div><label className="label">تاریخ</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="md:col-span-2"><label className="label">جستجو</label><div className="relative"><Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input className="input pr-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="نام، کد، بارکد، SKU..." /></div></div>
          <label className="flex items-end gap-2 text-sm text-slate-600 pb-3"><input type="checkbox" checked={onlyPositive} onChange={(e) => setOnlyPositive(e.target.checked)} /> فقط موجودی مثبت</label>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card p-4 text-center"><div className="text-xs text-slate-500">تعداد کل</div><div className="font-bold text-slate-800 mt-1">{toFaDigits(totalQty)}</div></div>
        <div className="card p-4 text-center"><div className="text-xs text-slate-500">ارزش خرید</div><div className="font-bold text-emerald-600 mt-1">{formatToman(totalValue)}</div></div>
        <div className="card p-4 text-center"><div className="text-xs text-slate-500">کم‌موجود</div><div className="font-bold text-amber-600 mt-1">{toFaDigits(lowCount)}</div></div>
      </div>

      {isLoading ? <Spinner /> : error ? <div className="rounded-xl bg-rose-50 text-rose-700 text-sm p-4">{(error as Error).message}</div> : rows.length === 0 ? <EmptyState icon={CalendarDays} title="موجودی برای نمایش وجود ندارد" /> : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>کالا</th><th>تنوع</th><th>کد/SKU</th><th>موجودی</th><th>قیمت خرید</th><th>ارزش</th><th>عملیات</th></tr></thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.variant_id} className="hover:bg-slate-50">
                  <td><EntityLink type="product" id={row.product_id}>{row.product_name}</EntityLink></td>
                  <td className="text-slate-500">{[row.color, row.size].filter(Boolean).join(" / ") || "ساده"}</td>
                  <td className="font-mono text-xs text-slate-400">{row.sku || row.product_code || row.barcode || "—"}</td>
                  <td className={row.stock_qty <= row.low_stock_threshold ? "font-bold text-amber-600" : "font-bold text-slate-800"}>{toFaDigits(row.stock_qty)}</td>
                  <td>{formatToman(row.purchase_price, false)}</td>
                  <td>{formatToman(row.stock_qty * row.purchase_price, false)}</td>
                  <td><EntityActionMenu type="product" id={row.product_id} label={row.product_name} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
