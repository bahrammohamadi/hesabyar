"use client";

import Link from "next/link";
import type { KeyboardEvent, MouseEvent } from "react";
import { Receipt } from "lucide-react";
import { EntityLink } from "@/components/shared/entity-link";
import { formatToman, toJalali } from "@/lib/utils/format";

type RecentSale = {
  id: string;
  invoice_no: string | null;
  date: string;
  total: number;
  customer_id: string | null;
  customer?: { name: string | null } | { name: string | null }[] | null;
};

function getCustomerName(customer: RecentSale["customer"]) {
  if (Array.isArray(customer)) return customer[0]?.name ?? null;
  return customer?.name ?? null;
}

export function DashboardRecentInvoices({
  sales,
  onOpenSale,
  onSaleClick,
  onSaleAuxClick,
}: {
  sales: RecentSale[] | undefined;
  onOpenSale: (id: string) => void;
  onSaleClick: (event: MouseEvent<HTMLElement>, id: string) => void;
  onSaleAuxClick: (event: MouseEvent<HTMLElement>, id: string) => void;
}) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-card p-4 shadow-sm sm:p-5">
      {/* هدر */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Receipt size={16} strokeWidth={2.2} />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-foreground">فاکتورهای اخیر</h2>
            <p className="text-[11px] text-muted-foreground">آخرین ۵ فاکتور</p>
          </div>
        </div>
        <Link
          href="/sales"
          className="rounded-xl bg-muted px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
        >
          همه فاکتورها
        </Link>
      </div>

      {/* لیست */}
      <div className="space-y-1">
        {sales && sales.length > 0 ? (
          sales.map((sale) => {
            const customerName = getCustomerName(sale.customer);
            return (
              <div
                key={sale.id}
                role="link"
                tabIndex={0}
                onClick={(event) => onSaleClick(event, sale.id)}
                onAuxClick={(event) => onSaleAuxClick(event, sale.id)}
                onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
                  if (event.key === "Enter") onOpenSale(sale.id);
                }}
                className="group flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition hover:bg-muted/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/sales/${sale.id}`}
                      className="text-sm font-semibold text-primary hover:underline"
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                        e.preventDefault();
                        e.stopPropagation();
                        onOpenSale(sale.id);
                      }}
                    >
                      {sale.invoice_no}
                    </Link>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{toJalali(sale.date)}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {sale.customer_id ? (
                      <EntityLink type="contact" id={sale.customer_id}>
                        {customerName ?? "مشتری"}
                      </EntityLink>
                    ) : (
                      "مشتری نقدی"
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-extrabold text-foreground tabular-nums">
                  {formatToman(sale.total, false)}
                </span>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-10">
            <Receipt size={28} className="text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">فاکتوری ثبت نشده</p>
          </div>
        )}
      </div>
    </div>
  );
}
