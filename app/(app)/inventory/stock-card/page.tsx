"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Download, PackageSearch, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState, PageHeader, Spinner } from "@/components/shared/ui";
import { DataTable } from "@/src/shared/ui";
import { DatePicker } from "@/components/shared/date-picker";
import { ProductSelector, type SelectableVariant } from "@/components/shared/product-selector";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { EntityLink } from "@/components/shared/entity-link";
import { toFaDigits, toJalali } from "@/lib/utils/format";

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

const TYPE_LABEL: Record<string, string> = {
  in: "ورود",
  out: "خروج",
  adjust: "تعدیل",
  transfer_in: "انتقال ورودی",
  transfer_out: "انتقال خروجی",
};

const REASON_LABEL: Record<string, string> = {
  purchase: "خرید",
  sale: "فروش",
  manual: "دستی",
  count: "شمارش",
  transfer: "انتقال",
  return: "مرجوعی",
  opening: "اول دوره",
};

export default function StockCardPage() {
  const [selected, setSelected] = useState<SelectableVariant | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: movements, isLoading, error } = useQuery({
    queryKey: ["stock-card", selected?.variant_id, fromDate, toDate],
    enabled: !!selected?.variant_id,
    queryFn: async () => {
      const supabase = createClient();
      let q = supabase
        .from("stock_movements")
        .select("id,type,reason,qty,note,created_at,ref_table,ref_id")
        .eq("variant_id", selected!.variant_id)
        .order("created_at", { ascending: true });
      if (fromDate) q = q.gte("created_at", new Date(`${fromDate}T00:00:00`).toISOString());
      if (toDate) q = q.lte("created_at", new Date(`${toDate}T23:59:59`).toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    let balance = 0;
    return (movements ?? []).map((movement: any) => {
      balance += movement.qty ?? 0;
      return { ...movement, balance };
    });
  }, [movements]);

  function refHref(row: any) {
    if (row.ref_table === "sales" && row.ref_id) return `/sales/${row.ref_id}`;
    if (row.ref_table === "purchases" && row.ref_id) return `/purchases/${row.ref_id}`;
    if (row.ref_table === "purchase_returns" && row.ref_id) return `/purchases/returns`;
    return null;
  }

  function exportExcel() {
    downloadCsv(`stock-card-${selected?.product_name ?? "product"}.csv`, rows.map((row) => ({
      date: row.created_at,
      type: TYPE_LABEL[row.type] ?? row.type,
      reason: REASON_LABEL[row.reason] ?? row.reason,
      qty: row.qty,
      balance: row.balance,
      ref_table: row.ref_table ?? "",
      ref_id: row.ref_id ?? "",
      note: row.note ?? "",
    })));
  }

  return (
    <div>
      <PageHeader
        title="کاردکس کالا"
        subtitle="تاریخچه کامل ورود، خروج، تعدیل و مانده تجمیعی هر کالا"
        action={selected && <button onClick={exportExcel} className="btn-secondary"><Download size={16} /> Excel</button>}
      />

      <div className="card p-4 mb-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
          <div className="flex-1">
            <label className="label">کالا / تنوع</label>
            {selected ? (
              <div className="rounded-xl border border-border p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <EntityLink type="product" id={selected.product_id}>{selected.product_name}</EntityLink>
                    <EntityActionMenu type="product" id={selected.product_id} label={selected.product_name} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{[selected.color, selected.size].filter(Boolean).join(" / ") || "ساده"} • موجودی فعلی: {toFaDigits(selected.stock_qty)}</div>
                </div>
                <button onClick={() => setPickerOpen(true)} className="btn-secondary text-sm"><Search size={15} /> تغییر</button>
              </div>
            ) : (
              <button onClick={() => setPickerOpen(true)} className="w-full rounded-xl border-2 border-dashed border-primary/20 bg-primary/[0.04] px-4 py-4 text-sm font-medium text-primary flex items-center justify-center gap-2"><PackageSearch size={18} /> انتخاب کالا</button>
            )}
          </div>
          <div><label className="label">از تاریخ</label><DatePicker value={fromDate} onChange={setFromDate} /></div>
          <div><label className="label">تا تاریخ</label><DatePicker value={toDate} onChange={setToDate} /></div>
        </div>
      </div>

      {!selected ? <EmptyState icon={PackageSearch} title="برای نمایش کاردکس، کالا را انتخاب کنید" /> : isLoading ? <Spinner /> : error ? (
        <div className="rounded-xl bg-destructive/10 text-destructive-text p-4 text-sm">{(error as Error).message}</div>
      ) : !rows.length ? <EmptyState title="گردشی برای این کالا ثبت نشده" /> : (
        <DataTable
          rows={rows}
          keyExtractor={(row: any) => row.id}
          className="bg-white/90"
          columns={[
            { key: "date", header: "تاریخ", render: (row: any) => toJalali(row.created_at, true) },
            { key: "type", header: "نوع", render: (row: any) => <span className={`badge ${(row.qty ?? 0) >= 0 ? "bg-success-soft text-success-onSoft" : "bg-destructive/15 text-destructive-text"}`}>{TYPE_LABEL[row.type] ?? row.type}</span> },
            { key: "reason", header: "دلیل", render: (row: any) => <span className="text-muted-foreground">{REASON_LABEL[row.reason] ?? row.reason}</span> },
            { key: "qty", header: "تعداد", render: (row: any) => <span className={(row.qty ?? 0) >= 0 ? "font-bold text-success-onSoft" : "font-bold text-destructive"}>{(row.qty ?? 0) >= 0 ? "+" : ""}{toFaDigits(row.qty ?? 0)}</span> },
            { key: "balance", header: "مانده", render: (row: any) => <span className="font-bold text-foreground">{toFaDigits(row.balance)}</span> },
            { key: "ref", header: "مرجع", render: (row: any) => { const href = refHref(row); return href ? <Link href={href} className="text-primary hover:underline">مشاهده</Link> : <span className="text-muted-foreground">—</span>; } },
            { key: "note", header: "توضیح", render: (row: any) => <span className="text-muted-foreground max-w-[220px] truncate">{row.note ?? "—"}</span> },
          ]}
        />
      )}

      <ProductSelector open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(variant) => { setSelected(variant); setPickerOpen(false); }} />
    </div>
  );
}
