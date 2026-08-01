"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, FileBarChart2 } from "lucide-react";
import { EntityLink } from "@/src/core/panel-manager/EntityLink";
import {
  useCustomerDebt,
  useDailySales,
  useMonthlyProfit,
  useProductProfitability,
  usePurchaseSummary,
  useTopProducts,
  type CustomerDebtReportRow,
  type DailySalesReportRow,
  type MonthlyProfitReportRow,
  type ProductProfitabilityReportRow,
  type PurchaseSummaryReportRow,
  type TopProductReportRow,
} from "@/src/core/services/reports-service";
import { Button, DataTable, EmptyState, Section, Spinner, Tabs, type Column } from "@/src/shared/ui";
import { Money, PersianDate, toPersianDigits } from "@/src/shared/format";

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    alert("داده‌ای برای خروجی وجود ندارد.");
    return;
  }
  const headers = Object.keys(rows[0]);
  const csv = "\ufeff" + [headers.map(csvEscape).join(","), ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))].join("\n");
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

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-white p-3 text-xs shadow-lg" dir="rtl">
      <div className="mb-1 font-bold text-foreground">{label}</div>
      {payload.map((item) => <div key={item.name}>{item.name}: {toPersianDigits(item.value.toLocaleString("en-US"))}</div>)}
    </div>
  );
}

function DailySalesSection() {
  const query = useDailySales();
  const rows = query.data ?? [];
  const columns: Column<DailySalesReportRow>[] = [
    { key: "date", header: "روز", render: (row) => <PersianDate value={row.sale_date} /> },
    { key: "count", header: "تعداد فاکتور", align: "center", render: (row) => toPersianDigits(row.invoice_count) },
    { key: "sales", header: "جمع فروش", align: "left", render: (row) => <Money value={row.total_sales} /> },
    { key: "discount", header: "تخفیف", align: "left", render: (row) => <Money value={row.total_discount} tone="credit" /> },
  ];
  const chartData = [...rows].reverse().map((row) => ({ date: row.sale_date, sales: Math.round(row.total_sales / 10), count: row.invoice_count }));
  return (
    <Section title="فروش روزانه" description="بر اساس v_daily_sales؛ تاریخ میلادی از DB و نمایش شمسی در UI">
      {query.isLoading ? <Spinner /> : rows.length === 0 ? <EmptyState title="فروشی ثبت نشده" /> : (
        <div className="space-y-4">
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="sales" name="فروش" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={() => downloadCsv("daily-sales.csv", rows.map((r) => ({ date: r.sale_date, invoice_count: r.invoice_count, total_sales: r.total_sales, total_discount: r.total_discount })))}>خروجی CSV</Button>
          <DataTable rows={rows} columns={columns} keyExtractor={(row) => row.sale_date} />
        </div>
      )}
    </Section>
  );
}

function CustomerDebtSection() {
  const query = useCustomerDebt();
  const rows = query.data ?? [];
  const columns: Column<CustomerDebtReportRow>[] = [
    { key: "name", header: "مشتری", render: (row) => <EntityLink type="contact" id={row.contact_id}>{row.contact_name}</EntityLink> },
    { key: "phone", header: "تلفن", render: (row) => <span dir="ltr">{row.phone ?? "—"}</span> },
    { key: "sales", header: "جمع فروش", align: "left", render: (row) => <Money value={row.total_sales} /> },
    { key: "received", header: "دریافتی", align: "left", render: (row) => <Money value={row.total_received} tone="positive" /> },
    { key: "debt", header: "بدهی", align: "left", render: (row) => <Money value={row.debt_amount} tone="debt" /> },
  ];
  return <Section title="بدهکاران" description="از v_customer_debt؛ کلیک روی مشتری پنل ContactPanel را باز می‌کند">{query.isLoading ? <Spinner /> : <><div className="mb-3"><Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={() => downloadCsv("customer-debt.csv", rows.map((r) => ({ contact_name: r.contact_name, phone: r.phone, total_sales: r.total_sales, total_received: r.total_received, debt_amount: r.debt_amount })))}>خروجی CSV</Button></div><DataTable rows={rows} columns={columns} keyExtractor={(row) => row.contact_id} empty={<EmptyState title="بدهکاری یافت نشد" />} /></>}</Section>;
}

function ProductProfitabilitySection() {
  const query = useProductProfitability();
  const rows = query.data ?? [];
  const columns: Column<ProductProfitabilityReportRow>[] = [
    { key: "product", header: "کالا", render: (row) => <EntityLink type="product" id={row.product_id}>{row.product_name}</EntityLink> },
    { key: "sku", header: "SKU", render: (row) => <span dir="ltr" className="font-mono">{row.sku ?? row.product_code ?? "—"}</span> },
    { key: "qty", header: "تعداد", align: "center", render: (row) => toPersianDigits(row.qty_sold) },
    { key: "sales", header: "فروش", align: "left", render: (row) => <Money value={row.sales_amount} /> },
    { key: "cost", header: "هزینه", align: "left", render: (row) => <Money value={row.cost_amount} /> },
    { key: "profit", header: "سود", align: "left", render: (row) => <Money value={row.gross_profit} tone={row.gross_profit >= 0 ? "positive" : "negative"} /> },
  ];
  return <Section title="سودآوری کالا" description="از v_product_profitability؛ قیمت تمام‌شده از snapshot یا fallbackهای فاز A محاسبه شده است.">{query.isLoading ? <Spinner /> : <><div className="mb-3"><Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={() => downloadCsv("product-profitability.csv", rows.map((r) => ({ product_name: r.product_name, sku: r.sku, qty_sold: r.qty_sold, sales_amount: r.sales_amount, cost_amount: r.cost_amount, gross_profit: r.gross_profit })))}>خروجی CSV</Button></div><DataTable rows={rows} columns={columns} keyExtractor={(row) => `${row.product_variant_id}`} empty={<EmptyState title="داده سودآوری وجود ندارد" />} /></>}</Section>;
}

function TopProductsSection() {
  const query = useTopProducts(20);
  const rows = query.data ?? [];
  const columns: Column<TopProductReportRow>[] = [
    { key: "product", header: "کالا", render: (row) => <EntityLink type="product" id={row.product_id}>{row.product_name}</EntityLink> },
    { key: "qty", header: "تعداد", align: "center", render: (row) => toPersianDigits(row.qty_sold) },
    { key: "amount", header: "مبلغ", align: "left", render: (row) => <Money value={row.sales_amount} /> },
  ];
  const chartData = rows.slice(0, 8).map((row) => ({ name: row.product_name, qty: Number(row.qty_sold), amount: Math.round(row.sales_amount / 10) }));
  return (
    <Section title="پرفروش‌ترین‌ها" description="از v_top_products">
      {query.isLoading ? <Spinner /> : rows.length === 0 ? <EmptyState title="فروشی برای رتبه‌بندی وجود ندارد" /> : (
        <div className="space-y-4">
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="qty" name="تعداد" fill="hsl(var(--primary))" /></BarChart></ResponsiveContainer>
          </div>
          <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={() => downloadCsv("top-products.csv", rows.map((r) => ({ product_name: r.product_name, qty_sold: r.qty_sold, sales_amount: r.sales_amount })))}>خروجی CSV</Button>
          <DataTable rows={rows} columns={columns} keyExtractor={(row) => row.product_variant_id} />
        </div>
      )}
    </Section>
  );
}

function MonthlyProfitSection() {
  const query = useMonthlyProfit();
  const rows = query.data ?? [];
  const columns: Column<MonthlyProfitReportRow>[] = [
    { key: "month", header: "ماه", render: (row) => <PersianDate value={row.month_start} /> },
    { key: "sales", header: "فروش", align: "left", render: (row) => <Money value={row.sales_amount} /> },
    { key: "cost", header: "هزینه", align: "left", render: (row) => <Money value={row.cost_amount} /> },
    { key: "profit", header: "سود", align: "left", render: (row) => <Money value={row.gross_profit} tone={row.gross_profit >= 0 ? "positive" : "negative"} /> },
  ];
  const chartData = [...rows].reverse().map((row) => ({ month: row.month_start, profit: Math.round(row.gross_profit / 10), sales: Math.round(row.sales_amount / 10) }));
  return <Section title="سود ماهانه" description="ماه‌ها میلادی در DB هستند؛ نمایش شمسی در UI انجام می‌شود.">{query.isLoading ? <Spinner /> : rows.length === 0 ? <EmptyState title="داده سود ماهانه وجود ندارد" /> : <div className="space-y-4"><div className="h-64" dir="ltr"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="month" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip content={<ChartTooltip />} /><Line type="monotone" dataKey="profit" name="سود" stroke="hsl(var(--success))" strokeWidth={2} /></LineChart></ResponsiveContainer></div><DataTable rows={rows} columns={columns} keyExtractor={(row) => row.month_start} /></div>}</Section>;
}

function PurchaseSummarySection() {
  const query = usePurchaseSummary();
  const rows = query.data ?? [];
  const columns: Column<PurchaseSummaryReportRow>[] = [
    { key: "date", header: "روز", render: (row) => <PersianDate value={row.purchase_date} /> },
    { key: "count", header: "تعداد", align: "center", render: (row) => toPersianDigits(row.purchase_count) },
    { key: "total", header: "جمع خرید", align: "left", render: (row) => <Money value={row.total_purchase} /> },
    { key: "discount", header: "تخفیف", align: "left", render: (row) => <Money value={row.total_discount} tone="credit" /> },
  ];
  return <Section title="خلاصه خرید" description="فعلاً در دیتای واقعی خریدی ثبت نشده؛ EmptyState مورد انتظار است.">{query.isLoading ? <Spinner /> : <DataTable rows={rows} columns={columns} keyExtractor={(row) => row.purchase_date} empty={<EmptyState title="هنوز خریدی برای گزارش ثبت نشده" />} />}</Section>;
}

export default function ReportsOverviewV2Page() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><FileBarChart2 size={24} /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">گزارش‌های جدید</h1>
          <p className="mt-1 text-sm text-muted-foreground">گزارش‌های view-based بر پایه فاز A، بدون تغییر صفحات گزارش legacy.</p>
        </div>
      </div>
      <Tabs
        items={[
          { value: "daily", label: "فروش روزانه", content: <DailySalesSection /> },
          { value: "debt", label: "بدهکاران", content: <CustomerDebtSection /> },
          { value: "profitability", label: "سودآوری کالا", content: <ProductProfitabilitySection /> },
          { value: "top", label: "پرفروش‌ترین‌ها", content: <TopProductsSection /> },
          { value: "monthly", label: "سود ماهانه", content: <MonthlyProfitSection /> },
          { value: "purchase", label: "خلاصه خرید", content: <PurchaseSummarySection /> },
        ]}
      />
    </div>
  );
}
