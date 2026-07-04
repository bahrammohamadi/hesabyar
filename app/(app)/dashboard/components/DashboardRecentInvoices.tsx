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
    <div className="card p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Receipt size={20} className="text-primary" />
          آخرین فاکتورها
        </h3>
        <Link href="/sales" className="text-xs text-primary hover:underline">
          مشاهده همه
        </Link>
      </div>
      <div className="space-y-3">
        {sales && sales.length > 0 ? (
          sales.map((sale) => (
            <div
              key={sale.id}
              role="link"
              tabIndex={0}
              onClick={(event) => onSaleClick(event, sale.id)}
              onAuxClick={(event) => onSaleAuxClick(event, sale.id)}
              onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
                if (event.key === "Enter") onOpenSale(sale.id);
              }}
              className="flex cursor-pointer items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-primary/30"
            >
              <div className="min-w-0">
                <Link
                  href={`/sales/${sale.id}`}
                  className="text-sm font-medium block truncate text-primary hover:underline"
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenSale(sale.id);
                  }}
                >
                  {sale.invoice_no}
                </Link>
                <div className="text-[11px] text-slate-400">
                  {sale.customer_id ? <EntityLink type="contact" id={sale.customer_id}>{getCustomerName(sale.customer) ?? "مشتری"}</EntityLink> : "مشتری نقدی"} • {toJalali(sale.date)}
                </div>
              </div>
              <div className="text-sm font-bold text-slate-700 shrink-0">{formatToman(sale.total, false)}</div>
            </div>
          ))
        ) : (
          <div className="text-center text-sm text-slate-400 py-8">فاکتوری یافت نشد.</div>
        )}
      </div>
    </div>
  );
}
