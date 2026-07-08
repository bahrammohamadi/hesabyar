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
    <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-900/[0.04] backdrop-blur sm:p-5">
      {/* هدر */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Receipt size={16} strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">فاکتورهای اخیر</h3>
            <p className="text-[11px] text-slate-400">آخرین ۵ فاکتور</p>
          </div>
        </div>
        <Link
          href="/sales"
          className="rounded-xl bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-500 transition hover:bg-primary/10 hover:text-primary"
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
                className="group flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
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
                    <span className="text-[10px] text-slate-300">{toJalali(sale.date)}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {sale.customer_id ? (
                      <EntityLink type="contact" id={sale.customer_id}>
                        {customerName ?? "مشتری"}
                      </EntityLink>
                    ) : (
                      "مشتری نقدی"
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-extrabold text-slate-700 tabular-nums">
                  {formatToman(sale.total, false)}
                </span>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-10">
            <Receipt size={28} className="text-slate-200" />
            <p className="text-sm text-slate-400">فاکتوری ثبت نشده</p>
          </div>
        )}
      </div>
    </div>
  );
}
