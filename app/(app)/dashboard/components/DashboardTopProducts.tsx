"use client";

import Link from "next/link";
import { Package, TrendingUp } from "lucide-react";
import { Card, Spinner } from "@/src/shared/ui";
import { formatToman, toFaDigits } from "@/lib/utils/format";

export type DashboardTopProduct = {
  product_variant_id: string;
  product_name: string;
  sku: string | null;
  qty_sold: number;
  sales_amount: number;
};

/**
 * ویجت «پرفروش‌ترین کالاها» — برگرفته از مرجع طراحی (_6 / alt widgets).
 *
 * داده از هوک موجود `useTopProducts` (v_top_products) می‌آید؛ هیچ کوئری جدیدی
 * ساخته نشده است. این کامپوننت فقط ظرف بصری است.
 */
export function DashboardTopProducts({
  isLoading,
  items,
}: {
  isLoading: boolean;
  items: DashboardTopProduct[] | undefined;
}) {
  const rows = (items ?? []).slice(0, 5);

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TrendingUp size={17} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-extrabold text-foreground">پرفروش‌ترین کالاها</h2>
            <p className="text-2xs text-muted-foreground">بر اساس تعداد فروش</p>
          </div>
        </div>
        <Link
          href="/reports/products"
          className="shrink-0 rounded-xl bg-muted px-3 py-1.5 text-2xs font-medium text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
        >
          مشاهده همه
        </Link>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
          <Package size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">هنوز فروشی ثبت نشده است</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((item, index) => (
            <li
              key={item.product_variant_id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-3 transition hover:border-primary/25 hover:bg-primary/[0.04]"
            >
              {/* رتبه — جایگزین تصویر محصول در مرجع، چون پروژه فیلد تصویر ندارد */}
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-extrabold tabular-nums text-primary">
                {toFaDigits(index + 1)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{item.product_name}</p>
                <p className="mt-0.5 truncate text-2xs text-muted-foreground">
                  فروش: {toFaDigits(item.qty_sold)} عدد
                  {item.sku && <span className="hidden sm:inline"> · {item.sku}</span>}
                </p>
              </div>

              <div className="shrink-0 text-left">
                <div className="text-sm font-extrabold tabular-nums text-primary">
                  {formatToman(item.sales_amount, false)}
                </div>
                <div className="text-2xs text-muted-foreground">تومان</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
