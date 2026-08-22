"use client";

import { useMemo, useState } from "react";
import { useOrgPrefs } from "@/lib/hooks/useOrgPrefs";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, UserCheck } from "lucide-react";
import { EmptyState, PageHeader, Spinner } from "@/components/shared/ui";
import { DataTable } from "@/src/shared/ui";
import { DatePicker } from "@/components/shared/date-picker";
import { formatToman, toFaDigits, toJalali } from "@/lib/utils/format";
import { downloadCsv } from "@/lib/export/download";



export default function SellerReportPage() {
  /* واحد پول سازمان — تومان یا ریال، از تنظیمات. */
  const { money, unitLabel: unitWord } = useOrgPrefs();
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
        <div><label className="label">از تاریخ</label><DatePicker value={from} onChange={setFrom} /></div>
        <div><label className="label">تا تاریخ</label><DatePicker value={to} onChange={setTo} /></div>
        <div className="rounded-xl bg-muted p-3"><div className="text-xs text-muted-foreground">مجموع فروش</div><div className="font-bold text-success-onSoft mt-1">{money(totals.sales_total)}</div></div>
        <div className="rounded-xl bg-muted p-3"><div className="text-xs text-muted-foreground">تعداد فاکتور</div><div className="font-bold text-foreground mt-1">{toFaDigits(totals.invoice_count)}</div></div>
      </div>

      {isLoading ? <Spinner /> : error ? <div className="rounded-xl bg-destructive/10 text-destructive-text text-sm p-4">{(error as Error).message}</div> : !data?.sellers?.length ? <EmptyState icon={UserCheck} title="داده‌ای برای این بازه وجود ندارد" /> : (
        <DataTable
          rows={data.sellers}
          keyExtractor={(seller) => seller.user_id ?? "unknown"}
          className="bg-white/90"
          columns={[
            { key: "seller", header: "فروشنده", render: (seller) => <><div className="font-medium text-foreground">{seller.user?.name ?? "نامشخص"}</div><div className="text-xs text-muted-foreground" dir="ltr">{seller.user?.email ?? ""}</div></> },
            { key: "invoice_count", header: "فاکتور", render: (seller) => toFaDigits(seller.invoice_count) },
            { key: "sales_total", header: "مبلغ فروش", render: (seller) => <span className="font-bold text-success-onSoft">{money(seller.sales_total, false)}</span> },
            { key: "credit_total", header: "نسیه", render: (seller) => <span className="text-destructive">{money(seller.credit_total, false)}</span> },
            { key: "average_invoice", header: "میانگین فاکتور", render: (seller) => money(seller.average_invoice, false) },
            { key: "activity_count", header: "فعالیت‌ها", render: (seller) => toFaDigits(seller.activity_count) },
            { key: "last_sale_at", header: "آخرین فروش", render: (seller) => seller.last_sale_at ? toJalali(seller.last_sale_at) : "—" },
          ]}
        />
      )}
    </div>
  );
}
