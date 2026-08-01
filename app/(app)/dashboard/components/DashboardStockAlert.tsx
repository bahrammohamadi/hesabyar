"use client";

import Link from "next/link";
import { AlertTriangle, PackageCheck } from "lucide-react";
import { Badge, Card } from "@/src/shared/ui";
import { toFaDigits } from "@/lib/utils/format";
/** یک قلم کالای کم‌موجود — از DashboardLowStock حذف‌شده به اینجا منتقل شد. */
export type DashboardLowStockItem = {
  variant_id: string;
  product_id: string | null;
  product_name: string;
  color: string | null;
  size: string | null;
  stock_qty: number;
  low_stock_threshold: number;
};

/**
 * ویجت «هشدار موجودی» — برگرفته از مرجع طراحی (_6 / alt widgets).
 *
 * داده از همان `dashboard_summary.low_stock_count` و کوئری موجود کالاهای
 * کم‌موجود می‌آید؛ هیچ کوئری جدیدی اضافه نشده است.
 */
export function DashboardStockAlert({
  lowStockCount,
  items,
}: {
  lowStockCount: number;
  items?: DashboardLowStockItem[];
}) {
  const hasAlert = lowStockCount > 0;
  const preview = (items ?? []).slice(0, 3);

  return (
    <Card
      className={
        hasAlert
          ? "relative overflow-hidden border-destructive/25 bg-destructive/[0.06] p-4 sm:p-5"
          : "relative overflow-hidden p-4 sm:p-5"
      }
    >
      {/* دکور پس‌زمینه — مطابق مرجع */}
      <div
        className={`pointer-events-none absolute -left-6 -bottom-6 h-28 w-28 rounded-full opacity-[0.07] ${
          hasAlert ? "bg-destructive" : "bg-success"
        }`}
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {hasAlert ? (
              <AlertTriangle size={16} className="shrink-0 text-destructive" strokeWidth={2.2} />
            ) : (
              <PackageCheck size={16} className="shrink-0 text-success" strokeWidth={2.2} />
            )}
            <h2
              className={`truncate text-sm font-extrabold ${
                hasAlert ? "text-destructive" : "text-foreground"
              }`}
            >
              هشدار موجودی
            </h2>
          </div>

          <div className="mt-2.5 flex items-baseline gap-2">
            <span
              className={`text-[28px] font-black leading-none tabular-nums ${
                hasAlert ? "text-destructive" : "text-muted-foreground/40"
              }`}
            >
              {toFaDigits(lowStockCount)}
            </span>
            <span className="text-xs text-muted-foreground">کالا زیر حد نصاب</span>
          </div>

          {hasAlert && (
            <div className="mt-2.5">
              <Badge tone="danger">نیاز به سفارش مجدد</Badge>
            </div>
          )}
        </div>
      </div>

      {hasAlert && preview.length > 0 && (
        <ul className="relative mt-4 space-y-1.5 border-t border-destructive/15 pt-3">
          {preview.map((item) => (
            <li key={item.variant_id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-foreground/80">
                {item.product_name}
                {(item.color || item.size) && (
                  <span className="text-muted-foreground">
                    {" · "}
                    {[item.color, item.size].filter(Boolean).join("/")}
                  </span>
                )}
              </span>
              <span className="shrink-0 rounded-lg bg-destructive/10 px-2 py-0.5 font-extrabold tabular-nums text-destructive-text">
                {toFaDigits(item.stock_qty)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {hasAlert && (
        <Link
          href="/inventory/in"
          className="relative mt-3 block rounded-xl bg-destructive/10 py-2 text-center text-xs font-extrabold text-destructive transition hover:bg-destructive/15"
        >
          ثبت ورود کالا
        </Link>
      )}
    </Card>
  );
}
