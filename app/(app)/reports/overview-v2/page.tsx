"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
import { Button, ChartEmpty, ChartSkeleton, chartGradients, DataTable, EmptyState, Section, Spinner, Tabs, activeDot, axisProps, chartCursor, compactAxisNumber, gradientId, tickInterval, useChartAnimation, type Column } from "@/src/shared/ui";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { Money, PersianDate, toPersianDigits } from "@/src/shared/format";
import { toJalali, toJalaliMonth, toJalaliShort } from "@/lib/utils/format";
import { downloadCsv } from "@/lib/export/download";



/**
 * تولتیپ نمودار.
 *
 * `labelKind` تعیین می‌کند برچسب چطور خوانده شود:
 *   "day"   → تاریخ کامل شمسی (۱۴۰۵/۰۵/۱۱)
 *   "month" → نام ماه شمسی (مرداد ۱۴۰۵)
 *   "text"  → همان متن، بدون تبدیل (مثلاً نام کالا)
 *
 * پیش‌تر `label` خام چاپ می‌شد، پس در نمودارهای تاریخی کاربر
 * «2026-07-12» می‌دید — تنها جای باقی‌مانده‌ی تاریخ میلادی در پنل.
 */
function ChartTooltip({ active, payload, label, labelKind = "text" }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string; labelKind?: "day" | "month" | "text" }) {
  if (!active || !payload?.length) return null;
  const heading =
    labelKind === "day" ? toJalali(label)
    : labelKind === "month" ? toJalaliMonth(label)
    : label;
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-xs shadow-lg" dir="rtl">
      <div className="mb-1 font-bold text-foreground">{heading}</div>
      {payload.map((item) => <div key={item.name} className="text-muted-foreground">{item.name}: <span className="font-bold text-foreground tabular-nums">{toPersianDigits(item.value.toLocaleString("en-US"))}</span></div>)}
    </div>
  );
}

function DailySalesSection() {
  const query = useDailySales();
  const isMobile = useIsMobile();
  const animate = useChartAnimation();
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
      {query.isLoading ? <ChartSkeleton /> : rows.length === 0 ? <ChartEmpty title="فروشی ثبت نشده" description="با ثبت اولین فاکتور، روند فروش اینجا نمایش داده می‌شود." /> : (
        <div className="space-y-4">
          <div className="h-56 sm:h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                {chartGradients(["primary"])}
                {/* خطوط عمودی حذف شد؛ شبکه‌ی دوطرفه نمودار را شلوغ می‌کرد. */}
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" {...axisProps} tickFormatter={toJalaliShort} interval={tickInterval(chartData.length, isMobile)} />
                <YAxis {...axisProps} tickFormatter={compactAxisNumber} width={isMobile ? 46 : 60} />
                <Tooltip content={<ChartTooltip labelKind="day" />} cursor={chartCursor} />
                <Area type="monotone" dataKey="sales" name="فروش" stroke="hsl(var(--primary))" strokeWidth={2.5} fill={`url(#${gradientId("primary")})`} dot={false} activeDot={{ ...activeDot, fill: "hsl(var(--primary))" }} isAnimationActive={animate} />
              </AreaChart>
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
  const isMobile = useIsMobile();
  const animate = useChartAnimation();
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
            <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="name" {...axisProps} interval={0} tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 11) + "…" : v)} /><YAxis {...axisProps} tickFormatter={compactAxisNumber} width={isMobile ? 46 : 60} /><Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--primary))", fillOpacity: 0.06 }} /><Bar dataKey="qty" name="تعداد" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={48} isAnimationActive={animate} /></BarChart></ResponsiveContainer>
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
  const isMobile = useIsMobile();
  const animate = useChartAnimation();
  const rows = query.data ?? [];
  const columns: Column<MonthlyProfitReportRow>[] = [
    { key: "month", header: "ماه", render: (row) => <PersianDate value={row.month_start} /> },
    { key: "sales", header: "فروش", align: "left", render: (row) => <Money value={row.sales_amount} /> },
    { key: "cost", header: "هزینه", align: "left", render: (row) => <Money value={row.cost_amount} /> },
    { key: "profit", header: "سود", align: "left", render: (row) => <Money value={row.gross_profit} tone={row.gross_profit >= 0 ? "positive" : "negative"} /> },
  ];
  const chartData = [...rows].reverse().map((row) => ({ month: row.month_start, profit: Math.round(row.gross_profit / 10), sales: Math.round(row.sales_amount / 10) }));
  return <Section title="سود ماهانه" description="ماه‌ها میلادی در DB هستند؛ نمایش شمسی در UI انجام می‌شود.">{query.isLoading ? <ChartSkeleton /> : rows.length === 0 ? <ChartEmpty title="داده سود ماهانه وجود ندارد" description="پس از ثبت فروش و خرید، سود هر ماه محاسبه می‌شود." /> : <div className="space-y-4"><div className="h-56 sm:h-64" dir="ltr"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>{chartGradients(["success"])}<CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="month" {...axisProps} tickFormatter={toJalaliMonth} interval={tickInterval(chartData.length, isMobile)} /><YAxis {...axisProps} tickFormatter={compactAxisNumber} width={isMobile ? 46 : 60} /><Tooltip content={<ChartTooltip labelKind="month" />} cursor={chartCursor} /><Area type="monotone" dataKey="profit" name="سود" stroke="hsl(var(--success))" strokeWidth={2.5} fill={`url(#${gradientId("success")})`} dot={false} activeDot={{ ...activeDot, fill: "hsl(var(--success))" }} isAnimationActive={animate} /></AreaChart></ResponsiveContainer></div><DataTable rows={rows} columns={columns} keyExtractor={(row) => row.month_start} /></div>}</Section>;
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
